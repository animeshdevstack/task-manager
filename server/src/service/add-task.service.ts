import mongoose from "mongoose";
import { AddTask } from "../model/add-task.model";
import { normalizeDatedTasks } from "../helper/dated-tasks.helper";
import {
  createReviewTaskFromAddTask,
  syncReviewTaskFromAddTask,
  deleteReviewTaskByTaskId,
  AddTaskForReview,
} from "./review-task.service";

type TaskNameDoc = { _id: mongoose.Types.ObjectId; taskName: string };

type DatedTaskDoc = { date: string; tasks: TaskNameDoc[] };

const mapPlanItems = (items: TaskNameDoc[]) =>
  items.map((t) => ({ _id: t._id, taskName: t.taskName }));

const toAddTaskForReview = (doc: {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  currentMonthAndYear: string;
  DailyTasks: TaskNameDoc[];
  WeeklyTasks: TaskNameDoc[];
  MonthlyTasks: TaskNameDoc[];
  DatedTasks?: DatedTaskDoc[];
}): AddTaskForReview => ({
  _id: doc._id,
  userId: doc.userId,
  currentMonthAndYear: doc.currentMonthAndYear,
  DailyTasks: mapPlanItems(doc.DailyTasks),
  WeeklyTasks: mapPlanItems(doc.WeeklyTasks),
  MonthlyTasks: mapPlanItems(doc.MonthlyTasks),
  DatedTasks: (doc.DatedTasks ?? []).map((entry) => ({
    date: entry.date,
    tasks: mapPlanItems(entry.tasks ?? []),
  })),
});

const formatCurrentMonthAndYear = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

const assertCurrentMonthPlan = (monthYear: string): void => {
  const current = formatCurrentMonthAndYear(new Date());
  if (monthYear !== current) {
    throw new Error("Tasks can only be created or modified for the current month");
  }
};

const isTransactionUnsupported = (error: unknown): boolean => {
  const msg = error instanceof Error ? error.message : String(error);
  return /Transaction numbers|replica set|not support.*transaction/i.test(msg);
};

const runWithTransaction = async <T>(
  fn: (session?: mongoose.ClientSession) => Promise<T>,
): Promise<T> => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    if (isTransactionUnsupported(error)) {
      return fn(undefined);
    }
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("Internal server error");
  } finally {
    session.endSession();
  }
};

const CreateTaskService = async (data: any, userId: string): Promise<any> => {
  try {
    const { DailyTasks, WeeklyTasks, MonthlyTasks } = data;
    const monthYear = formatCurrentMonthAndYear(new Date());
    assertCurrentMonthPlan(monthYear);
    const DatedTasks = normalizeDatedTasks(data.DatedTasks, monthYear);

    return await runWithTransaction(async (session) => {
      const created = await AddTask.create(
        [
          {
            userId,
            createdBy: userId,
            currentMonthAndYear: monthYear,
            DailyTasks,
            WeeklyTasks,
            MonthlyTasks,
            DatedTasks,
          },
        ],
        session ? { session } : {},
      );

      const doc = created[0];
      if (!doc) {
        throw new Error("Failed to create task");
      }

      await createReviewTaskFromAddTask(toAddTaskForReview(doc), session);
      return doc;
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("Internal server error");
  }
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const GetTasksService = async (
  userId: string,
  options: { page?: number; limit?: number } = {},
): Promise<any> => {
  try {
    const page = Math.max(1, Math.floor(options.page ?? DEFAULT_PAGE) || DEFAULT_PAGE);
    const limitRaw = Math.floor(options.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT;
    const limit = Math.min(MAX_LIMIT, Math.max(1, limitRaw));
    const skip = (page - 1) * limit;

    const filter = { userId };
    const [tasks, total] = await Promise.all([
      AddTask.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      AddTask.countDocuments(filter),
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
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("Internal server error");
  }
};

const GetTaskByIdService = async (id: string, userId: string): Promise<any> => {
  try {
    const task = await AddTask.findOne({ _id: id, userId });
    if (!task) {
      throw new Error("Task not found");
    }
    return task;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("Internal server error");
  }
};

const UpdateTaskService = async (id: string, data: any, userId: string): Promise<any> => {
  try {
    const { DailyTasks, WeeklyTasks, MonthlyTasks } = data;

    const existing = await AddTask.findOne({ _id: id, userId });
    if (!existing) {
      throw new Error("Task not found");
    }
    assertCurrentMonthPlan(existing.currentMonthAndYear);
    const DatedTasks = normalizeDatedTasks(data.DatedTasks, existing.currentMonthAndYear);

    return await runWithTransaction(async (session) => {
      const updated = await AddTask.findOneAndUpdate(
        { _id: id, userId },
        { DailyTasks, WeeklyTasks, MonthlyTasks, DatedTasks },
        { new: true, runValidators: true, ...(session ? { session } : {}) },
      );
      if (!updated) {
        throw new Error("Task not found");
      }

      await syncReviewTaskFromAddTask(toAddTaskForReview(updated), session);
      return updated;
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("Internal server error");
  }
};

const DeleteTaskService = async (id: string, userId: string): Promise<any> => {
  try {
    return await runWithTransaction(async (session) => {
      const findQuery = AddTask.findOne({ _id: id, userId });
      if (session) findQuery.session(session);
      const existing = await findQuery;
      if (!existing) {
        throw new Error("Task not found");
      }
      assertCurrentMonthPlan(existing.currentMonthAndYear);

      const deleteQuery = AddTask.findOneAndDelete({ _id: id, userId });
      if (session) deleteQuery.session(session);
      const deleted = await deleteQuery;
      if (!deleted) {
        throw new Error("Task not found");
      }

      await deleteReviewTaskByTaskId(id, userId, session);
      return deleted;
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("Internal server error");
  }
};

export {
  CreateTaskService,
  GetTasksService,
  GetTaskByIdService,
  UpdateTaskService,
  DeleteTaskService,
};
