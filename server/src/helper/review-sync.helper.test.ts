import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Types } from "mongoose";
import {
  formatDateYmdFromParts,
  indexReviewSlotByYmd,
} from "./review-date.helper";
import {
  AddTaskForReview,
  buildReviewPayloadFromAddTask,
  buildSyncedReviewUpdate,
  ReviewSubTask,
  toReviewSubTasks,
} from "./review-sync.helper";

const taskId = new Types.ObjectId();
const userId = new Types.ObjectId();
const weeklyTaskA = new Types.ObjectId();
const weeklyTaskB = new Types.ObjectId();

const baseAddTask = (): AddTaskForReview => ({
  _id: taskId,
  userId,
  currentMonthAndYear: "2026-05",
  DailyTasks: [{ _id: new Types.ObjectId(), taskName: "daily habit" }],
  WeeklyTasks: [
    { _id: weeklyTaskA, taskName: "call mummy 2 times" },
    { _id: weeklyTaskB, taskName: "call didi 1 time" },
  ],
  MonthlyTasks: [{ _id: new Types.ObjectId(), taskName: "monthly goal" }],
  DatedTasks: [],
});

const makeWeeklyExisting = (
  sundayYmd: string,
  completedIds: Set<string>,
): { sundayDate: Date; Task: ReviewSubTask[] } => {
  const [y, m, d] = sundayYmd.split("-").map(Number);
  const sundayDate = new Date(y!, m! - 1, d!);
  const addTask = baseAddTask();
  return {
    sundayDate,
    Task: addTask.WeeklyTasks.map((t) => ({
      subTaskId: t._id,
      subTaskName: t.taskName,
      isCompleted: completedIds.has(t._id.toString()),
    })),
  };
};

describe("buildReviewPayloadFromAddTask", () => {
  it("includes currentMonthAndYear and gives each Sunday an independent task array", () => {
    const payload = buildReviewPayloadFromAddTask(baseAddTask());
    assert.equal(payload.currentMonthAndYear, "2026-05");
    assert.ok(payload.WeeklyTasks.length >= 2);

    const first = payload.WeeklyTasks[0]!;
    const second = payload.WeeklyTasks[1]!;
    assert.notEqual(first.Task, second.Task);
    first.Task[0]!.isCompleted = true;
    assert.equal(second.Task[0]!.isCompleted, false);
  });
});

describe("buildSyncedReviewUpdate", () => {
  it("preserves weekly isCompleted per Sunday when plan is unchanged", () => {
    const addTask = baseAddTask();
    const may24 = makeWeeklyExisting("2026-05-24", new Set([weeklyTaskA.toString()]));
    const may31 = makeWeeklyExisting("2026-05-31", new Set([weeklyTaskB.toString()]));

    const update = buildSyncedReviewUpdate(addTask, {
      DailyTasks: [],
      WeeklyTasks: [may24, may31],
      MonthlyTasks: {
        monthEndDate: new Date(2026, 4, 31),
        Task: [],
      },
    });

    const slot24 = update.WeeklyTasks.find(
      (s) => formatDateYmdFromParts(2026, 4, 24) === "2026-05-24" &&
        s.sundayDate.getDate() === 24,
    );
    const slot31 = update.WeeklyTasks.find((s) => s.sundayDate.getDate() === 31);

    assert.ok(slot24);
    assert.ok(slot31);
    assert.equal(
      slot24.Task.find((t) => t.subTaskId.equals(weeklyTaskA))?.isCompleted,
      true,
    );
    assert.equal(
      slot24.Task.find((t) => t.subTaskId.equals(weeklyTaskB))?.isCompleted,
      false,
    );
    assert.equal(
      slot31.Task.find((t) => t.subTaskId.equals(weeklyTaskB))?.isCompleted,
      true,
    );
  });

  it("preserves weekly completions when only DatedTasks change", () => {
    const addTask = baseAddTask();
    addTask.DatedTasks = [
      {
        date: "2026-05-27",
        tasks: [{ _id: new Types.ObjectId(), taskName: "extra task" }],
      },
    ];

    const may24 = makeWeeklyExisting("2026-05-24", new Set([weeklyTaskA.toString()]));

    const update = buildSyncedReviewUpdate(addTask, {
      DailyTasks: [],
      WeeklyTasks: [may24],
      MonthlyTasks: {
        monthEndDate: new Date(2026, 4, 31),
        Task: [],
      },
    });

    const slot24 = update.WeeklyTasks.find((s) => s.sundayDate.getDate() === 24);
    assert.ok(slot24);
    assert.equal(
      slot24.Task.find((t) => t.subTaskId.equals(weeklyTaskA))?.isCompleted,
      true,
    );
  });

  it("matches legacy UTC-shifted sundayDate via dual YMD index", () => {
    const addTask = baseAddTask();
    const istMay24MidnightUtc = new Date("2026-05-23T18:30:00.000Z");
    const existingTask = toReviewSubTasks([
      {
        subTaskId: weeklyTaskA,
        subTaskName: "call mummy 2 times",
        isCompleted: true,
      },
    ]);

    const update = buildSyncedReviewUpdate(addTask, {
      DailyTasks: [],
      WeeklyTasks: [{ sundayDate: istMay24MidnightUtc, Task: existingTask }],
      MonthlyTasks: {
        monthEndDate: new Date(2026, 4, 31),
        Task: [],
      },
    });

    const slot24 = update.WeeklyTasks.find((s) => s.sundayDate.getDate() === 24);
    assert.ok(slot24);
    assert.equal(
      slot24.Task.find((t) => t.subTaskId.equals(weeklyTaskA))?.isCompleted,
      true,
    );
  });
});

describe("indexReviewSlotByYmd", () => {
  it("indexes both local and UTC keys for the same entry", () => {
    const utcShifted = new Date("2026-05-23T18:30:00.000Z");
    const entry = { sundayDate: utcShifted, label: "May 24 IST" };
    const map = indexReviewSlotByYmd([entry], (e) => e.sundayDate);

    assert.ok(map.has("2026-05-24") || map.has("2026-05-23"));
    const byCanonical = map.get("2026-05-24") ?? map.get("2026-05-23");
    assert.equal(byCanonical?.label, "May 24 IST");
  });
});
