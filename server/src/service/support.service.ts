import mongoose from "mongoose";
import { User } from "../model/user.model";
import { SupportTicket } from "../model/support-ticket.model";
import { SupportActionLog } from "../model/support-action-log.model";
import {
  GetReviewTaskByIdService,
  GetReviewTasksService,
  PatchReviewTaskCompletionService,
} from "./review-task.service";
import { GetTasksService } from "./add-task.service";
import {
  getPrivateSubTaskIds,
  stripPrivateFromAddTask,
  stripPrivateFromReviewTask,
} from "./shared-tasks.service";
import { AddTask } from "../model/add-task.model";
import {
  getLastDateOfMonth,
  instantMatchesCalendarYmd,
} from "../helper/dated-tasks.helper";
import {
  findReviewSlotByYmd,
  indexReviewSlotByYmd,
} from "../helper/review-date.helper";

const MIN_SEARCH = 2;
const MAX_RESULTS = 20;

type ReviewSubTask = {
  subTaskId?: { toString(): string };
  subTaskName?: string;
  isCompleted?: boolean;
};

type ReviewForTicket = {
  currentMonthAndYear?: string;
  DailyTasks?: { todayDate: Date; Task?: ReviewSubTask[] }[];
  WeeklyTasks?: { sundayDate: Date; Task?: ReviewSubTask[] }[];
  MonthlyTasks?: { monthEndDate: Date; Task?: ReviewSubTask[] };
};

const findReviewSubTask = (
  review: ReviewForTicket,
  type: "daily" | "weekly" | "monthly",
  dateYmd: string,
  subTaskId: string,
): ReviewSubTask | null => {
  const monthYear = review.currentMonthAndYear ?? "";

  if (type === "daily") {
    const byYmd = indexReviewSlotByYmd(
      review.DailyTasks ?? [],
      (entry) => entry.todayDate,
    );
    const slot = findReviewSlotByYmd(
      review.DailyTasks ?? [],
      byYmd,
      dateYmd,
      monthYear,
      (entry) => entry.todayDate,
    );
    const match = (slot?.Task ?? []).find(
      (t) => (t.subTaskId?.toString?.() ?? String(t.subTaskId)) === subTaskId,
    );
    return match ?? null;
  }

  if (type === "weekly") {
    const byYmd = indexReviewSlotByYmd(
      review.WeeklyTasks ?? [],
      (entry) => entry.sundayDate,
    );
    const slot = findReviewSlotByYmd(
      review.WeeklyTasks ?? [],
      byYmd,
      dateYmd,
      monthYear,
      (entry) => entry.sundayDate,
    );
    const match = (slot?.Task ?? []).find(
      (t) => (t.subTaskId?.toString?.() ?? String(t.subTaskId)) === subTaskId,
    );
    return match ?? null;
  }

  const monthEndYmd = monthYear ? getLastDateOfMonth(monthYear) : "";
  const monthMatches =
    Boolean(monthEndYmd) &&
    (dateYmd === monthEndYmd ||
      (review.MonthlyTasks?.monthEndDate != null &&
        instantMatchesCalendarYmd(review.MonthlyTasks.monthEndDate, dateYmd)));
  if (!monthMatches) return null;
  const match = (review.MonthlyTasks?.Task ?? []).find(
    (t) => (t.subTaskId?.toString?.() ?? String(t.subTaskId)) === subTaskId,
  );
  return match ?? null;
};

/**
 * Read-only: ensure each task exists on the review slot and is still incomplete.
 * Does not mutate ReviewTask.
 */
const assertIncompleteTicketTasks = (
  review: ReviewForTicket,
  type: "daily" | "weekly" | "monthly",
  dateYmd: string,
  tasks: { subTaskId: string; subTaskName: string }[],
): void => {
  for (const task of tasks) {
    const found = findReviewSubTask(review, type, dateYmd, task.subTaskId);
    if (!found) {
      throw new Error(
        `Task "${task.subTaskName}" was not found for ${type} on ${dateYmd}`,
      );
    }
    if (found.isCompleted === true) {
      throw new Error(
        `Task "${task.subTaskName}" is already completed and cannot be requested`,
      );
    }
  }
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const SearchUsersForSupportService = async (
  query: string,
): Promise<unknown[]> => {
  const trimmed = query.trim();
  if (trimmed.length < MIN_SEARCH) {
    return [];
  }

  const rx = new RegExp(escapeRegex(trimmed), "i");
  const users = await User.find({
    role: "user",
    isActive: { $ne: false },
    $or: [{ email: rx }, { Fname: rx }, { Lname: rx }],
  })
    .select("Fname Lname email")
    .limit(MAX_RESULTS)
    .lean()
    .exec();

  return users.map((u) => ({
    id: u._id.toString(),
    Fname: u.Fname,
    Lname: u.Lname,
    email: u.email,
  }));
};

const assertTargetUser = async (userId: string) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user id");
  }
  const user = await User.findOne({ _id: userId, role: "user" })
    .select("Fname Lname email role")
    .lean();
  if (!user) {
    throw new Error("User not found");
  }
  return user;
};

const GetTargetUserAddTasksService = async (
  targetUserId: string,
  month?: string,
  includePrivate = false,
) => {
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw new Error("Invalid user id");
  }
  const data = (await GetTasksService(targetUserId, { month })) as {
    task?: unknown;
    tasks?: unknown[];
    pagination?: unknown;
  };

  if (includePrivate) {
    return data;
  }

  const stripOne = (doc: unknown) =>
    doc ? stripPrivateFromAddTask(doc) : doc;

  return {
    ...data,
    task: stripOne(data.task),
    tasks: Array.isArray(data.tasks) ? data.tasks.map(stripOne) : data.tasks,
  };
};

const GetTargetUserReviewTasksService = async (
  targetUserId: string,
  month?: string,
  includePrivate = false,
) => {
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw new Error("Invalid user id");
  }
  const data = (await GetReviewTasksService(targetUserId, { month })) as {
    task?: unknown;
    tasks?: unknown[];
    pagination?: unknown;
  };

  if (includePrivate) {
    return data;
  }

  const monthKey =
    typeof month === "string" && month.trim() ? month.trim() : undefined;
  const addTask = monthKey
    ? await AddTask.findOne({
        userId: targetUserId,
        currentMonthAndYear: monthKey,
      }).exec()
    : null;
  const privateIds = addTask
    ? getPrivateSubTaskIds(addTask as Parameters<typeof getPrivateSubTaskIds>[0])
    : new Set<string>();

  const stripOne = (doc: unknown) =>
    doc ? stripPrivateFromReviewTask(doc, privateIds) : doc;

  return {
    ...data,
    task: stripOne(data.task),
    tasks: Array.isArray(data.tasks) ? data.tasks.map(stripOne) : data.tasks,
  };
};

const GetTargetUserReviewTaskByIdService = async (
  targetUserId: string,
  reviewId: string,
  includePrivate = false,
) => {
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw new Error("Invalid user id");
  }
  const review = await GetReviewTaskByIdService(reviewId, targetUserId);
  if (includePrivate) {
    return review;
  }

  const reviewDoc = review as { currentMonthAndYear?: string; TaskId?: { toString(): string } };
  const addTask = await AddTask.findOne({
    userId: targetUserId,
    ...(reviewDoc.currentMonthAndYear
      ? { currentMonthAndYear: reviewDoc.currentMonthAndYear }
      : reviewDoc.TaskId
        ? { _id: reviewDoc.TaskId }
        : {}),
  }).exec();

  const privateIds = addTask
    ? getPrivateSubTaskIds(addTask as Parameters<typeof getPrivateSubTaskIds>[0])
    : new Set<string>();

  return stripPrivateFromReviewTask(review, privateIds);
};

const logSupportAction = async (entry: {
  actorId: string;
  actorRole: "admin" | "support";
  targetUserId: string;
  reviewTaskId: string;
  type: "daily" | "weekly" | "monthly";
  dateYmd: string;
  subTaskId: string;
  isCompleted: boolean;
  ticketId?: string;
  note?: string;
}) => {
  await SupportActionLog.create({
    actorId: entry.actorId,
    actorRole: entry.actorRole,
    targetUserId: entry.targetUserId,
    reviewTaskId: entry.reviewTaskId,
    type: entry.type,
    dateYmd: entry.dateYmd,
    subTaskId: entry.subTaskId,
    isCompleted: entry.isCompleted,
    ticketId: entry.ticketId,
    note: entry.note,
  });
};

const PatchTargetUserReviewService = async (params: {
  actorId: string;
  actorRole: "admin" | "support";
  targetUserId: string;
  reviewId: string;
  type: "daily" | "weekly" | "monthly";
  dateYmd?: string;
  date?: string | Date;
  subTaskId: string;
  isCompleted: boolean;
  note?: string;
  ticketId?: string;
  userTimezone?: string;
}) => {
  await assertTargetUser(params.targetUserId);

  const review = await PatchReviewTaskCompletionService(
    params.reviewId,
    params.targetUserId,
    {
      type: params.type,
      dateYmd: params.dateYmd,
      date: params.date,
      subTaskId: params.subTaskId,
      isCompleted: params.isCompleted,
    },
    params.userTimezone ?? "UTC",
    { relaxDateRules: true },
  );

  const dateYmd =
    params.dateYmd?.trim() ||
    (typeof params.date === "string" ? params.date.slice(0, 10) : "");

  await logSupportAction({
    actorId: params.actorId,
    actorRole: params.actorRole,
    targetUserId: params.targetUserId,
    reviewTaskId: params.reviewId,
    type: params.type,
    dateYmd,
    subTaskId: params.subTaskId,
    isCompleted: params.isCompleted,
    ticketId: params.ticketId,
    note: params.note,
  });

  return review;
};

/** Mongoose optional ObjectIds are typed as `T | null | undefined`. */
type IdLike = { toString(): string } | null | undefined;

const normalizeTicketTasks = (t: {
  tasks?: { subTaskId?: IdLike; subTaskName?: string | null }[];
  subTaskId?: IdLike;
  subTaskName?: string | null;
}): { subTaskId: string; subTaskName: string }[] => {
  if (Array.isArray(t.tasks) && t.tasks.length > 0) {
    return t.tasks.map((item) => ({
      subTaskId: item.subTaskId?.toString?.() ?? String(item.subTaskId),
      subTaskName: item.subTaskName?.trim() || "Task",
    }));
  }
  if (t.subTaskId) {
    return [
      {
        subTaskId: t.subTaskId.toString(),
        subTaskName: t.subTaskName?.trim() || "Task",
      },
    ];
  }
  return [];
};

const CreateSupportTicketService = async (params: {
  userId: string;
  reviewTaskId: string;
  type: "daily" | "weekly" | "monthly";
  dateYmd: string;
  tasks: { subTaskId: string; subTaskName: string }[];
  message: string;
}) => {
  const message = params.message?.trim();
  if (!message) {
    throw new Error("Message is required");
  }
  if (!["daily", "weekly", "monthly"].includes(params.type)) {
    throw new Error("Invalid type");
  }
  if (!params.dateYmd?.trim()) {
    throw new Error("dateYmd is required");
  }
  if (!Array.isArray(params.tasks) || params.tasks.length === 0) {
    throw new Error("At least one task is required");
  }

  const tasks = params.tasks.map((t) => {
    if (!t.subTaskId) {
      throw new Error("Each task requires subTaskId");
    }
    return {
      subTaskId: t.subTaskId,
      subTaskName: t.subTaskName?.trim() || "Task",
    };
  });

  // Ensure the review belongs to the requester (read-only — never marks complete)
  const review = (await GetReviewTaskByIdService(
    params.reviewTaskId,
    params.userId,
  )) as ReviewForTicket;

  assertIncompleteTicketTasks(
    review,
    params.type,
    params.dateYmd.trim(),
    tasks,
  );

  const ticket = await SupportTicket.create({
    userId: params.userId,
    reviewTaskId: params.reviewTaskId,
    type: params.type,
    dateYmd: params.dateYmd.trim(),
    tasks,
    message,
    status: "open",
  });

  return ticket;
};

const ListMyTicketsService = async (userId: string) => {
  const tickets = await SupportTicket.find({ userId })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean()
    .exec();

  return tickets.map((t) => {
    const tasks = normalizeTicketTasks(t);
    return {
      id: t._id.toString(),
      reviewTaskId: t.reviewTaskId?.toString(),
      type: t.type,
      dateYmd: t.dateYmd,
      tasks,
      subTaskId: tasks[0]?.subTaskId,
      subTaskName: tasks.map((item) => item.subTaskName).join(", "),
      message: t.message,
      status: t.status,
      resolvedBy: t.resolvedBy?.toString(),
      resolvedAt: t.resolvedAt,
      resolutionNote: t.resolutionNote,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  });
};

const mapStaffTicket = (t: {
  _id: mongoose.Types.ObjectId;
  userId: unknown;
  reviewTaskId?: IdLike;
  type: string;
  dateYmd: string;
  tasks?: { subTaskId?: IdLike; subTaskName?: string | null }[];
  subTaskId?: IdLike;
  subTaskName?: string | null;
  message: string;
  status: string;
  resolvedBy?: IdLike;
  resolvedAt?: Date | null;
  resolutionNote?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}) => {
  const user = t.userId as
    | { _id: mongoose.Types.ObjectId; Fname?: string; Lname?: string; email?: string }
    | mongoose.Types.ObjectId
    | null;
  const userObj =
    user && typeof user === "object" && "email" in user
      ? {
          id: user._id.toString(),
          Fname: user.Fname,
          Lname: user.Lname,
          email: user.email,
        }
      : {
          id:
            user && typeof user === "object" && "_id" in user
              ? String(user._id)
              : String(t.userId),
        };

  const tasks = normalizeTicketTasks(t);

  return {
    id: t._id.toString(),
    user: userObj,
    reviewTaskId: t.reviewTaskId?.toString(),
    type: t.type,
    dateYmd: t.dateYmd,
    tasks,
    subTaskId: tasks[0]?.subTaskId,
    subTaskName: tasks.map((item) => item.subTaskName).join(", "),
    message: t.message,
    status: t.status,
    resolvedBy: t.resolvedBy?.toString(),
    resolvedAt: t.resolvedAt,
    resolutionNote: t.resolutionNote,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
};

const ListTicketsService = async (status?: string) => {
  const filter: Record<string, unknown> = {};
  if (status && ["open", "resolved", "rejected", "cancelled"].includes(status)) {
    filter.status = status;
  }

  const tickets = await SupportTicket.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("userId", "Fname Lname email")
    .lean()
    .exec();

  return tickets.map((t) => mapStaffTicket(t));
};

const GetTicketByIdService = async (ticketId: string) => {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw new Error("Invalid ticket id");
  }

  const ticket = await SupportTicket.findById(ticketId)
    .populate("userId", "Fname Lname email")
    .lean()
    .exec();

  if (!ticket) {
    throw new Error("Ticket not found");
  }

  return mapStaffTicket(ticket);
};

const ResolveTicketService = async (params: {
  ticketId: string;
  actorId: string;
  actorRole: "admin" | "support";
  status: "resolved" | "rejected";
  resolutionNote?: string;
  markComplete?: boolean;
  userTimezone?: string;
}) => {
  if (!mongoose.Types.ObjectId.isValid(params.ticketId)) {
    throw new Error("Invalid ticket id");
  }

  const ticket = await SupportTicket.findById(params.ticketId);
  if (!ticket) {
    throw new Error("Ticket not found");
  }
  if (ticket.status !== "open") {
    throw new Error("Ticket is already closed");
  }

  if (params.status === "resolved" && params.markComplete === true) {
    const tasks = normalizeTicketTasks(ticket);
    if (tasks.length === 0) {
      throw new Error("Ticket has no tasks to complete");
    }
    for (const task of tasks) {
      await PatchTargetUserReviewService({
        actorId: params.actorId,
        actorRole: params.actorRole,
        targetUserId: ticket.userId.toString(),
        reviewId: ticket.reviewTaskId.toString(),
        type: ticket.type as "daily" | "weekly" | "monthly",
        dateYmd: ticket.dateYmd,
        date: `${ticket.dateYmd}T12:00:00`,
        subTaskId: task.subTaskId,
        isCompleted: true,
        note: params.resolutionNote,
        ticketId: ticket._id.toString(),
        userTimezone: params.userTimezone,
      });
    }
  }

  ticket.status = params.status;
  ticket.resolvedBy = new mongoose.Types.ObjectId(params.actorId);
  ticket.resolvedAt = new Date();
  if (params.resolutionNote?.trim()) {
    ticket.resolutionNote = params.resolutionNote.trim();
  }
  await ticket.save();

  return ticket;
};

const CancelMyTicketService = async (userId: string, ticketId: string) => {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw new Error("Invalid ticket id");
  }

  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) {
    throw new Error("Ticket not found");
  }
  if (ticket.userId.toString() !== userId) {
    throw new Error("Forbidden");
  }
  if (ticket.status !== "open") {
    throw new Error("Only open tickets can be revoked");
  }

  ticket.status = "cancelled";
  await ticket.save();
  return ticket;
};

export {
  SearchUsersForSupportService,
  GetTargetUserAddTasksService,
  GetTargetUserReviewTasksService,
  GetTargetUserReviewTaskByIdService,
  PatchTargetUserReviewService,
  CreateSupportTicketService,
  ListMyTicketsService,
  ListTicketsService,
  GetTicketByIdService,
  ResolveTicketService,
  CancelMyTicketService,
  assertTargetUser,
  MIN_SEARCH,
};
