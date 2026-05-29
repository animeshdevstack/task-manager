import { ClientSession, Types } from "mongoose";
import { AddTask } from "../model/add-task.model";
import { ReviewTask } from "../model/review-task.model";
import {
  buildDatedSubTaskIdMap,
  formatDateYmd,
  isAllowedDatedTaskDate,
} from "../helper/dated-tasks.helper";
import { isSameCalendarDay } from "../helper/review-date.helper";
import {
  AddTaskForReview,
  buildReviewPayloadFromAddTask,
  buildSyncedReviewUpdate,
  toReviewSubTasks,
} from "../helper/review-sync.helper";

export type { AddTaskForReview, DatedTaskEntry } from "../helper/review-sync.helper";

const createReviewTaskFromAddTask = async (
  addTaskDoc: AddTaskForReview,
  session?: ClientSession,
): Promise<unknown> => {
  const payload = buildReviewPayloadFromAddTask(addTaskDoc);
  const [review] = await ReviewTask.create([payload], session ? { session } : {});
  return review;
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

  const addTask = await AddTask.findOne({ _id: review.TaskId, userId });
  const datedSubTaskDates = buildDatedSubTaskIdMap(
    addTask?.DatedTasks as { date: string; tasks?: { _id?: Types.ObjectId }[] }[] | undefined,
  );

  let updated = false;

  if (type === "daily") {
    const scheduledDatedDate = datedSubTaskDates.get(subTaskId);
    if (scheduledDatedDate) {
      const targetYmd = formatDateYmd(targetDate);
      const todayYmd = formatDateYmd(new Date());
      if (targetYmd !== scheduledDatedDate) {
        throw new Error("Daily extras can only be updated on their scheduled date");
      }
      if (targetYmd !== todayYmd) {
        throw new Error("Daily extras can only be updated for today");
      }
      const monthYear = addTask?.currentMonthAndYear;
      if (
        !monthYear ||
        !isAllowedDatedTaskDate(scheduledDatedDate, monthYear)
      ) {
        throw new Error("Cannot update completion for this date");
      }
    }

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
