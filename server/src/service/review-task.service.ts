import { ClientSession, Types } from "mongoose";
import { ReviewTask } from "../model/review-task.model";
import {
  getAllDaysInMonth,
  getAllSundaysInMonth,
  getLastDayOfMonth,
  isSameCalendarDay,
} from "../helper/review-date.helper";

type PlanTaskItem = { _id: Types.ObjectId; taskName: string };

export type AddTaskForReview = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  currentMonthAndYear: string;
  DailyTasks: PlanTaskItem[];
  WeeklyTasks: PlanTaskItem[];
  MonthlyTasks: PlanTaskItem[];
};

type ReviewSubTask = {
  subTaskId: Types.ObjectId;
  subTaskName: string;
  isCompleted: boolean;
};

const buildSubTasksFromPlan = (items: PlanTaskItem[]): ReviewSubTask[] =>
  items.map((item) => ({
    subTaskId: item._id,
    subTaskName: item.taskName,
    isCompleted: false,
  }));

const mergeSubTasksWithExisting = (
  planItems: PlanTaskItem[],
  existingTasks: ReviewSubTask[] = [],
): ReviewSubTask[] => {
  const existingById = new Map(
    existingTasks.map((t) => [t.subTaskId.toString(), t]),
  );

  return planItems.map((item) => {
    const existing = existingById.get(item._id.toString());
    if (existing) {
      return {
        subTaskId: item._id,
        subTaskName: item.taskName,
        isCompleted: existing.isCompleted,
      };
    }
    return {
      subTaskId: item._id,
      subTaskName: item.taskName,
      isCompleted: false,
    };
  });
};

const buildReviewPayloadFromAddTask = (addTaskDoc: AddTaskForReview) => {
  const monthYear = addTaskDoc.currentMonthAndYear;
  const dailySubTasks = buildSubTasksFromPlan(addTaskDoc.DailyTasks);
  const weeklySubTasks = buildSubTasksFromPlan(addTaskDoc.WeeklyTasks);
  const monthlySubTasks = buildSubTasksFromPlan(addTaskDoc.MonthlyTasks);

  return {
    userId: addTaskDoc.userId,
    TaskId: addTaskDoc._id,
    DailyTasks: getAllDaysInMonth(monthYear).map((todayDate) => ({
      todayDate,
      Task: dailySubTasks,
    })),
    WeeklyTasks: getAllSundaysInMonth(monthYear).map((sundayDate) => ({
      sundayDate,
      Task: weeklySubTasks,
    })),
    MonthlyTasks: {
      monthEndDate: getLastDayOfMonth(monthYear),
      Task: monthlySubTasks,
    },
  };
};

const createReviewTaskFromAddTask = async (
  addTaskDoc: AddTaskForReview,
  session?: ClientSession,
): Promise<unknown> => {
  const payload = buildReviewPayloadFromAddTask(addTaskDoc);
  const [review] = await ReviewTask.create([payload], session ? { session } : {});
  return review;
};

const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const toReviewSubTasks = (
  tasks: { subTaskId: Types.ObjectId; subTaskName: string; isCompleted: boolean }[],
): ReviewSubTask[] =>
  tasks.map((t) => ({
    subTaskId: t.subTaskId,
    subTaskName: t.subTaskName,
    isCompleted: t.isCompleted,
  }));

const buildSyncedReviewUpdate = (
  addTaskDoc: AddTaskForReview,
  existing: {
    DailyTasks: { todayDate: Date; Task: ReviewSubTask[] }[];
    WeeklyTasks: { sundayDate: Date; Task: ReviewSubTask[] }[];
    MonthlyTasks: { monthEndDate: Date; Task: ReviewSubTask[] };
  },
) => {
  const monthYear = addTaskDoc.currentMonthAndYear;

  const existingDailyByDate = new Map(
    existing.DailyTasks.map((entry) => [dateKey(entry.todayDate), entry]),
  );
  const existingWeeklyByDate = new Map(
    existing.WeeklyTasks.map((entry) => [dateKey(entry.sundayDate), entry]),
  );

  return {
    DailyTasks: getAllDaysInMonth(monthYear).map((todayDate) => {
      const prev = existingDailyByDate.get(dateKey(todayDate));
      return {
        todayDate,
        Task: mergeSubTasksWithExisting(
          addTaskDoc.DailyTasks,
          prev ? toReviewSubTasks(prev.Task) : [],
        ),
      };
    }),
    WeeklyTasks: getAllSundaysInMonth(monthYear).map((sundayDate) => {
      const prev = existingWeeklyByDate.get(dateKey(sundayDate));
      return {
        sundayDate,
        Task: mergeSubTasksWithExisting(
          addTaskDoc.WeeklyTasks,
          prev ? toReviewSubTasks(prev.Task) : [],
        ),
      };
    }),
    MonthlyTasks: {
      monthEndDate: getLastDayOfMonth(monthYear),
      Task: mergeSubTasksWithExisting(
        addTaskDoc.MonthlyTasks,
        toReviewSubTasks(existing.MonthlyTasks.Task),
      ),
    },
  };
};

const syncReviewTaskFromAddTask = async (
  addTaskDoc: AddTaskForReview,
  session?: ClientSession,
): Promise<unknown> => {
  const existing = await ReviewTask.findOne({
    TaskId: addTaskDoc._id,
    userId: addTaskDoc.userId,
  }).session(session ?? null);

  if (!existing) {
    return createReviewTaskFromAddTask(addTaskDoc, session);
  }

  const update = buildSyncedReviewUpdate(addTaskDoc, {
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

  return ReviewTask.findOneAndUpdate(
    { TaskId: addTaskDoc._id, userId: addTaskDoc.userId },
    { $set: update },
    { new: true, session: session ?? undefined },
  );
};

const deleteReviewTaskByTaskId = async (
  taskId: string,
  userId: string,
  session?: ClientSession,
): Promise<void> => {
  await ReviewTask.deleteOne({ TaskId: taskId, userId }).session(
    session ?? null,
  );
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const GetReviewTasksService = async (
  userId: string,
  options: { page?: number; limit?: number } = {},
): Promise<unknown> => {
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
  date: string | Date;
  subTaskId: string;
  isCompleted: boolean;
};

const PatchReviewTaskCompletionService = async (
  id: string,
  userId: string,
  payload: PatchReviewPayload,
): Promise<unknown> => {
  const { type, date, subTaskId, isCompleted } = payload;
  const targetDate = new Date(date);
  if (Number.isNaN(targetDate.getTime())) {
    throw new Error("Invalid date");
  }

  const review = await ReviewTask.findOne({ _id: id, userId });
  if (!review) {
    throw new Error("Review task not found");
  }

  let updated = false;

  if (type === "daily") {
    for (const entry of review.DailyTasks) {
      if (!isSameCalendarDay(entry.todayDate, targetDate)) continue;
      for (const task of entry.Task) {
        if (task.subTaskId.toString() === subTaskId) {
          task.isCompleted = isCompleted;
          updated = true;
          break;
        }
      }
      if (updated) break;
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
  createReviewTaskFromAddTask,
  syncReviewTaskFromAddTask,
  deleteReviewTaskByTaskId,
  GetReviewTasksService,
  GetReviewTaskByIdService,
  PatchReviewTaskCompletionService,
};
