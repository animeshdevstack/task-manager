import mongoose from "mongoose";
import { AddTask } from "../model/add-task.model";
import { ReviewTask } from "../model/review-task.model";
import { UserFollow } from "../model/user-follow.model";

type TaskItem = {
  _id?: mongoose.Types.ObjectId;
  taskName: string;
  isPrivate?: boolean;
};

type ReviewSubTask = {
  subTaskId?: mongoose.Types.ObjectId;
  subTaskName: string;
  isCompleted: boolean;
};

const toPlain = <T>(doc: T): T => {
  if (doc && typeof doc === "object" && "toObject" in doc && typeof (doc as { toObject: () => T }).toObject === "function") {
    return (doc as { toObject: () => T }).toObject();
  }
  return doc;
};

const getPrivateSubTaskIds = (addTask: {
  DailyTasks: TaskItem[];
  WeeklyTasks: TaskItem[];
  MonthlyTasks: TaskItem[];
}): Set<string> => {
  const ids = new Set<string>();
  for (const list of [addTask.DailyTasks, addTask.WeeklyTasks, addTask.MonthlyTasks]) {
    for (const item of list ?? []) {
      if (item.isPrivate && item._id) {
        ids.add(item._id.toString());
      }
    }
  }
  return ids;
};

const stripPrivateFromAddTask = (doc: unknown): unknown => {
  const plain = toPlain(doc) as {
    DailyTasks?: TaskItem[];
    WeeklyTasks?: TaskItem[];
    MonthlyTasks?: TaskItem[];
    [key: string]: unknown;
  };

  const filterList = (items: TaskItem[]) =>
    (items ?? [])
      .filter((t) => !t.isPrivate)
      .map(({ taskName, _id }) => ({ taskName, ...(_id ? { _id } : {}) }));

  return {
    ...plain,
    DailyTasks: filterList(plain.DailyTasks ?? []),
    WeeklyTasks: filterList(plain.WeeklyTasks ?? []),
    MonthlyTasks: filterList(plain.MonthlyTasks ?? []),
  };
};

const stripPrivateFromReviewTask = (
  doc: unknown,
  privateSubTaskIds: Set<string>,
): unknown => {
  const plain = toPlain(doc) as {
    DailyTasks?: { todayDate: Date; Task: ReviewSubTask[] }[];
    WeeklyTasks?: { sundayDate: Date; Task: ReviewSubTask[] }[];
    MonthlyTasks?: { monthEndDate: Date; Task: ReviewSubTask[] };
    [key: string]: unknown;
  };

  const filterTasks = (tasks: ReviewSubTask[]) =>
    (tasks ?? []).filter((t) => {
      const id = t.subTaskId?.toString?.() ?? String(t.subTaskId);
      return !privateSubTaskIds.has(id);
    });

  const daily = plain.DailyTasks?.map((entry) => ({
    ...entry,
    Task: filterTasks(entry.Task),
  }));

  const weekly = plain.WeeklyTasks?.map((entry) => ({
    ...entry,
    Task: filterTasks(entry.Task),
  }));

  const monthly = plain.MonthlyTasks
    ? {
        ...plain.MonthlyTasks,
        Task: filterTasks(plain.MonthlyTasks.Task),
      }
    : plain.MonthlyTasks;

  return {
    ...plain,
    DailyTasks: daily,
    WeeklyTasks: weekly,
    MonthlyTasks: monthly,
  };
};

const assertAcceptedFollower = async (
  viewerId: string,
  targetUserId: string,
): Promise<void> => {
  if (viewerId === targetUserId) {
    throw new Error("Cannot view your own tasks through follow endpoints");
  }

  const targetFollow = await UserFollow.findOne({
    userId: targetUserId,
    followerList: {
      $elemMatch: {
        userId: new mongoose.Types.ObjectId(viewerId),
        status: "accepted",
      },
    },
  }).exec();

  if (!targetFollow) {
    throw new Error("Not authorized to view this user's tasks");
  }
};

const GetSharedAddTaskService = async (
  viewerId: string,
  targetUserId: string,
  month: string,
): Promise<unknown> => {
  await assertAcceptedFollower(viewerId, targetUserId);

  const addTask = await AddTask.findOne({
    userId: targetUserId,
    currentMonthAndYear: month,
  }).exec();

  if (!addTask) {
    return null;
  }

  return stripPrivateFromAddTask(addTask);
};

const GetSharedReviewTaskService = async (
  viewerId: string,
  targetUserId: string,
  month: string,
): Promise<unknown> => {
  await assertAcceptedFollower(viewerId, targetUserId);

  const addTask = await AddTask.findOne({
    userId: targetUserId,
    currentMonthAndYear: month,
  }).exec();

  if (!addTask) {
    return null;
  }

  const review = await ReviewTask.findOne({
    userId: targetUserId,
    TaskId: addTask._id,
  }).exec();

  if (!review) {
    return null;
  }

  const privateIds = getPrivateSubTaskIds(addTask);
  return stripPrivateFromReviewTask(review, privateIds);
};

export {
  assertAcceptedFollower,
  stripPrivateFromAddTask,
  stripPrivateFromReviewTask,
  getPrivateSubTaskIds,
  GetSharedAddTaskService,
  GetSharedReviewTaskService,
};
