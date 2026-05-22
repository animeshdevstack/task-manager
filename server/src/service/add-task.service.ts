import { AddTask } from "../model/add-task.model";

const formatCurrentMonthAndYear = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

const CreateTaskService = async (data: any, userId: string): Promise<any> => {
  try {
    const { DailyTasks, WeeklyTasks, MonthlyTasks } = data;
    const doc = await AddTask.create({
      userId,
      createdBy: userId,
      currentMonthAndYear: formatCurrentMonthAndYear(new Date()),
      DailyTasks,
      WeeklyTasks,
      MonthlyTasks,
    });
    return doc;
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
    const updated = await AddTask.findOneAndUpdate(
      { _id: id, userId },
      { DailyTasks, WeeklyTasks, MonthlyTasks },
      { new: true, runValidators: true },
    );
    if (!updated) {
      throw new Error("Task not found");
    }
    return updated;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("Internal server error");
  }
};

const DeleteTaskService = async (id: string, userId: string): Promise<any> => {
  try {
    const deleted = await AddTask.findOneAndDelete({ _id: id, userId });
    if (!deleted) {
      throw new Error("Task not found");
    }
    return deleted;
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
