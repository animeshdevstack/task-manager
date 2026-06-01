import { Types } from "mongoose";
import { formatDateYmd } from "./dated-tasks.helper";
import {
  findReviewSlotByYmd,
  getAllDaysInMonth,
  getAllSundaysInMonth,
  getLastDayOfMonth,
  indexReviewSlotByYmd,
} from "./review-date.helper";

export type PlanTaskItem = { _id: Types.ObjectId; taskName: string };

export type DatedTaskEntry = {
  date: string;
  tasks: PlanTaskItem[];
};

export type AddTaskForReview = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  currentMonthAndYear: string;
  DailyTasks: PlanTaskItem[];
  WeeklyTasks: PlanTaskItem[];
  MonthlyTasks: PlanTaskItem[];
  DatedTasks: DatedTaskEntry[];
};

export type ReviewSubTask = {
  subTaskId: Types.ObjectId;
  subTaskName: string;
  isCompleted: boolean;
};

const getDatedPlanItemsForDate = (
  datedTasks: DatedTaskEntry[],
  dayDate: Date,
): PlanTaskItem[] => {
  const key = formatDateYmd(dayDate);
  const entry = datedTasks.find((e) => e.date === key);
  return entry?.tasks ?? [];
};

export const dailyPlanItemsForDate = (
  addTaskDoc: AddTaskForReview,
  dayDate: Date,
): PlanTaskItem[] => [
  ...addTaskDoc.DailyTasks,
  ...getDatedPlanItemsForDate(addTaskDoc.DatedTasks ?? [], dayDate),
];

export const buildSubTasksFromPlan = (items: PlanTaskItem[]): ReviewSubTask[] =>
  items.map((item) => ({
    subTaskId: item._id,
    subTaskName: item.taskName,
    isCompleted: false,
  }));

const normalizeTaskName = (name: string): string => name.trim().toLowerCase();

export const mergeSubTasksWithExisting = (
  planItems: PlanTaskItem[],
  existingTasks: ReviewSubTask[] = [],
): ReviewSubTask[] => {
  const existingById = new Map(
    existingTasks.map((t) => [t.subTaskId.toString(), t]),
  );
  const usedExistingIds = new Set<string>();

  return planItems.map((item) => {
    let existing = existingById.get(item._id.toString());

    if (!existing) {
      const planName = normalizeTaskName(item.taskName);
      for (const prev of existingTasks) {
        const prevId = prev.subTaskId.toString();
        if (usedExistingIds.has(prevId)) continue;
        if (normalizeTaskName(prev.subTaskName) === planName) {
          existing = prev;
          break;
        }
      }
    }

    if (existing) {
      usedExistingIds.add(existing.subTaskId.toString());
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

export const toReviewSubTasks = (
  tasks: { subTaskId: Types.ObjectId; subTaskName: string; isCompleted: boolean }[],
): ReviewSubTask[] =>
  tasks.map((t) => ({
    subTaskId: t.subTaskId,
    subTaskName: t.subTaskName,
    isCompleted: t.isCompleted,
  }));

export const buildReviewPayloadFromAddTask = (addTaskDoc: AddTaskForReview) => {
  const monthYear = addTaskDoc.currentMonthAndYear;
  const monthlySubTasks = buildSubTasksFromPlan(addTaskDoc.MonthlyTasks);

  return {
    userId: addTaskDoc.userId,
    TaskId: addTaskDoc._id,
    currentMonthAndYear: monthYear,
    DailyTasks: getAllDaysInMonth(monthYear).map(({ date }) => ({
      todayDate: date,
      Task: mergeSubTasksWithExisting(dailyPlanItemsForDate(addTaskDoc, date), []),
    })),
    WeeklyTasks: getAllSundaysInMonth(monthYear).map(({ date }) => ({
      sundayDate: date,
      Task: buildSubTasksFromPlan(addTaskDoc.WeeklyTasks),
    })),
    MonthlyTasks: {
      monthEndDate: getLastDayOfMonth(monthYear),
      Task: monthlySubTasks,
    },
  };
};

export const buildSyncedReviewUpdate = (
  addTaskDoc: AddTaskForReview,
  existing: {
    DailyTasks: { todayDate: Date; Task: ReviewSubTask[] }[];
    WeeklyTasks: { sundayDate: Date; Task: ReviewSubTask[] }[];
    MonthlyTasks: { monthEndDate: Date; Task: ReviewSubTask[] };
  },
) => {
  const monthYear = addTaskDoc.currentMonthAndYear;

  const existingDailyByYmd = indexReviewSlotByYmd(
    existing.DailyTasks,
    (entry) => entry.todayDate,
  );
  const existingWeeklyByYmd = indexReviewSlotByYmd(
    existing.WeeklyTasks,
    (entry) => entry.sundayDate,
  );

  return {
    DailyTasks: getAllDaysInMonth(monthYear).map(({ date, ymd }) => {
      const prev = findReviewSlotByYmd(
        existing.DailyTasks,
        existingDailyByYmd,
        ymd,
        monthYear,
        (entry) => entry.todayDate,
      );
      return {
        todayDate: date,
        Task: mergeSubTasksWithExisting(
          dailyPlanItemsForDate(addTaskDoc, date),
          prev ? toReviewSubTasks(prev.Task) : [],
        ),
      };
    }),
    WeeklyTasks: getAllSundaysInMonth(monthYear).map(({ date, ymd }) => {
      const prev = findReviewSlotByYmd(
        existing.WeeklyTasks,
        existingWeeklyByYmd,
        ymd,
        monthYear,
        (entry) => entry.sundayDate,
      );
      return {
        sundayDate: date,
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
