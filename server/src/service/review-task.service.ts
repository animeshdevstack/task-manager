import { ClientSession, Types } from "mongoose";
import { AddTask } from "../model/add-task.model";
import { ReviewTask } from "../model/review-task.model";
import {
  buildDatedSubTaskIdMap,
  DATE_YMD_RE,
  isAllowedDatedTaskDate,
  resolvePatchDateYmd,
} from "../helper/dated-tasks.helper";
import {
  findReviewSlotByYmd,
  indexReviewSlotByYmd,
  isSameCalendarDay,
} from "../helper/review-date.helper";
import {
  AddTaskForReview,
  buildReviewPayloadFromAddTask,
  buildSyncedReviewUpdate,
  dailyPlanItemsForYmd,
  toReviewSubTasks,
} from "../helper/review-sync.helper";

export type { AddTaskForReview, DatedTaskEntry } from "../helper/review-sync.helper";

const MONTH_YM_RE = /^\d{4}-\d{2}$/;

type ReviewDocLike = {
  DailyTasks: { todayDate: Date; Task: { subTaskId: Types.ObjectId; subTaskName: string; isCompleted: boolean }[] }[];
  WeeklyTasks: { sundayDate: Date; Task: { subTaskId: Types.ObjectId; subTaskName: string; isCompleted: boolean }[] }[];
  MonthlyTasks: {
    monthEndDate: Date;
    Task: { subTaskId: Types.ObjectId; subTaskName: string; isCompleted: boolean }[];
  };
};

const existingReviewState = (existing: ReviewDocLike) => ({
  DailyTasks: existing.DailyTasks.map((e) => ({
    todayDate: e.todayDate,
    Task: toReviewSubTasks(e.Task),
  })),
  WeeklyTasks: existing.WeeklyTasks.map((e) => ({
    sundayDate: e.sundayDate,
    Task: toReviewSubTasks(e.Task),
  })),
  MonthlyTasks: {
    monthEndDate: existing.MonthlyTasks.monthEndDate,
    Task: toReviewSubTasks(existing.MonthlyTasks.Task),
  },
});

const upsertReviewTaskFromAddTask = async (
  addTaskDoc: AddTaskForReview,
  session?: ClientSession,
): Promise<unknown> => {
  const existing = await ReviewTask.findOne({
    userId: addTaskDoc.userId,
    currentMonthAndYear: addTaskDoc.currentMonthAndYear,
  }).session(session ?? null);

  if (existing) {
    const update = buildSyncedReviewUpdate(addTaskDoc, existingReviewState(existing));

    return ReviewTask.findOneAndUpdate(
      { _id: existing._id },
      {
        $set: {
          ...update,
          TaskId: addTaskDoc._id,
          currentMonthAndYear: addTaskDoc.currentMonthAndYear,
        },
      },
      { new: true, session: session ?? undefined },
    );
  }

  const payload = buildReviewPayloadFromAddTask(addTaskDoc);
  const [review] = await ReviewTask.create([payload], session ? { session } : {});
  return review;
};

const deleteReviewTaskByTaskId = async (
  taskId: string,
  userId: string,
  session?: ClientSession,
): Promise<void> => {
  const query = ReviewTask.deleteOne({ TaskId: taskId, userId });
  if (session) {
    query.session(session);
  }
  await query;
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const GetReviewTasksService = async (
  userId: string,
  options: { page?: number; limit?: number; month?: string } = {},
): Promise<unknown> => {
  if (options.month) {
    if (!MONTH_YM_RE.test(options.month)) {
      throw new Error("Invalid month format (YYYY-MM)");
    }

    const task = await ReviewTask.findOne({
      userId,
      currentMonthAndYear: options.month,
    }).exec();

    return {
      task,
      tasks: task ? [task] : [],
      pagination: {
        page: 1,
        limit: 1,
        total: task ? 1 : 0,
        totalPages: task ? 1 : 0,
      },
    };
  }

  const page = Math.max(1, Math.floor(options.page ?? DEFAULT_PAGE) || DEFAULT_PAGE);
  const limitRaw = Math.floor(options.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, Math.max(1, limitRaw));
  const skip = (page - 1) * limit;

  const filter = { userId };
  const [tasks, total] = await Promise.all([
    ReviewTask.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
    ReviewTask.countDocuments(filter),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    tasks,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

const GetReviewTaskByIdService = async (
  id: string,
  userId: string,
): Promise<unknown> => {
  const task = await ReviewTask.findOne({ _id: id, userId });
  if (!task) {
    throw new Error("Review task not found");
  }
  return task;
};

type PatchReviewPayload = {
  type: "daily" | "weekly" | "monthly";
  date?: string | Date;
  dateYmd?: string;
  subTaskId: string;
  isCompleted: boolean;
};

const PatchReviewTaskCompletionService = async (
  id: string,
  userId: string,
  payload: PatchReviewPayload,
): Promise<unknown> => {
  const { type, date, dateYmd, subTaskId, isCompleted } = payload;
  const targetYmd = resolvePatchDateYmd({ dateYmd, date });
  const targetDate =
    date != null && !DATE_YMD_RE.test(String(date).trim())
      ? new Date(date)
      : new Date(`${targetYmd}T12:00:00`);

  const review = await ReviewTask.findOne({ _id: id, userId });
  if (!review) {
    throw new Error("Review task not found");
  }

  const addTask = await AddTask.findOne({ _id: review.TaskId, userId });
  const datedSubTaskDates = buildDatedSubTaskIdMap(
    addTask?.DatedTasks as { date: string; tasks?: { _id?: Types.ObjectId }[] }[] | undefined,
  );
  const monthYear =
    review.currentMonthAndYear ?? addTask?.currentMonthAndYear ?? "";

  let updated = false;

  if (type === "daily") {
    const scheduledDatedDate = datedSubTaskDates.get(subTaskId);
    if (scheduledDatedDate) {
      if (targetYmd !== scheduledDatedDate) {
        throw new Error("Daily extras can only be updated on their scheduled date");
      }
      if (
        !monthYear ||
        !isAllowedDatedTaskDate(scheduledDatedDate, monthYear)
      ) {
        throw new Error("Cannot update completion for this date");
      }
    }

    const dailyByYmd = indexReviewSlotByYmd(
      review.DailyTasks,
      (entry) => entry.todayDate,
    );
    const dailySlot = findReviewSlotByYmd(
      review.DailyTasks,
      dailyByYmd,
      targetYmd,
      monthYear,
      (entry) => entry.todayDate,
    );
    const applyCompletionInSlot = (
      slot: (typeof review.DailyTasks)[number],
    ): boolean => {
      for (const task of slot.Task) {
        if (task.subTaskId.toString() === subTaskId) {
          task.isCompleted = isCompleted;
          return true;
        }
      }
      return false;
    };

    if (dailySlot) {
      updated = applyCompletionInSlot(dailySlot);
    }

    // Dated add-on may live on a legacy-shifted slot or was never merged into review.
    if (!updated && scheduledDatedDate) {
      for (const entry of review.DailyTasks) {
        if (applyCompletionInSlot(entry)) {
          updated = true;
          break;
        }
      }
    }

    const slotForHeal =
      dailySlot ??
      findReviewSlotByYmd(
        review.DailyTasks,
        dailyByYmd,
        targetYmd,
        monthYear,
        (entry) => entry.todayDate,
      );
    if (!updated && scheduledDatedDate && addTask && slotForHeal) {
      const planItem = dailyPlanItemsForYmd(
        addTask as AddTaskForReview,
        targetYmd,
      ).find((item) => item._id.toString() === subTaskId);
      if (planItem) {
        slotForHeal.Task.push({
          subTaskId: planItem._id,
          subTaskName: planItem.taskName,
          isCompleted,
        });
        updated = true;
      }
    }
  } else if (type === "weekly") {
    for (const entry of review.WeeklyTasks) {
      if (!isSameCalendarDay(entry.sundayDate, targetDate)) continue;
      for (const task of entry.Task) {
        if (task.subTaskId.toString() === subTaskId) {
          task.isCompleted = isCompleted;
          updated = true;
          break;
        }
      }
      if (updated) break;
    }
  } else if (type === "monthly") {
    if (isSameCalendarDay(review.MonthlyTasks.monthEndDate, targetDate)) {
      for (const task of review.MonthlyTasks.Task) {
        if (task.subTaskId.toString() === subTaskId) {
          task.isCompleted = isCompleted;
          updated = true;
          break;
        }
      }
    }
  } else {
    throw new Error("Invalid type. Use daily, weekly, or monthly");
  }

  if (!updated) {
    throw new Error("Sub task or date slot not found");
  }

  review.markModified("DailyTasks");
  review.markModified("WeeklyTasks");
  review.markModified("MonthlyTasks");
  await review.save();
  return review;
};

export {
  upsertReviewTaskFromAddTask,
  deleteReviewTaskByTaskId,
  GetReviewTasksService,
  GetReviewTaskByIdService,
  PatchReviewTaskCompletionService,
};
