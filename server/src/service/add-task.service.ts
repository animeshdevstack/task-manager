import mongoose from "mongoose";
import { AddTask } from "../model/add-task.model";
import {
  createReviewTaskFromAddTask,
  syncReviewTaskFromAddTask,
  deleteReviewTaskByTaskId,
  AddTaskForReview,
} from "./review-task.service";

const toAddTaskForReview = (doc: {
  _id: import("mongoose").Types.ObjectId;
  userId: import("mongoose").Types.ObjectId;
  currentMonthAndYear: string;
  DailyTasks: { _id: import("mongoose").Types.ObjectId; taskName: string }[];
  WeeklyTasks: { _id: import("mongoose").Types.ObjectId; taskName: string }[];
  MonthlyTasks: { _id: import("mongoose").Types.ObjectId; taskName: string }[];
}): AddTaskForReview => ({
  _id: doc._id,
  userId: doc.userId,
  currentMonthAndYear: doc.currentMonthAndYear,
  DailyTasks: doc.DailyTasks.map((t) => ({ _id: t._id, taskName: t.taskName })),
  WeeklyTasks: doc.WeeklyTasks.map((t) => ({ _id: t._id, taskName: t.taskName })),
  MonthlyTasks: doc.MonthlyTasks.map((t) => ({ _id: t._id, taskName: t.taskName })),
});

const formatCurrentMonthAndYear = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
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

    return await runWithTransaction(async (session) => {
      const created = await AddTask.create(
        [
          {
            userId,
            createdBy: userId,
            currentMonthAndYear: formatCurrentMonthAndYear(new Date()),
            DailyTasks,
            WeeklyTasks,
            MonthlyTasks,
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

    return await runWithTransaction(async (session) => {
      const updated = await AddTask.findOneAndUpdate(
        { _id: id, userId },
        { DailyTasks, WeeklyTasks, MonthlyTasks },
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
