import { Schema, model } from "mongoose";

const reviewSubTaskSchema = new Schema(
  {
    subTaskId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    subTaskName: {
      type: String,
      required: true,
    },
    isCompleted: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { _id: false },
);

const reviewDailyEntrySchema = new Schema(
  {
    todayDate: {
      type: Date,
      required: true,
    },
    Task: {
      type: [reviewSubTaskSchema],
      default: [],
    },
  },
  { _id: false },
);

const reviewWeeklyEntrySchema = new Schema(
  {
    sundayDate: {
      type: Date,
      required: true,
    },
    Task: {
      type: [reviewSubTaskSchema],
      default: [],
    },
  },
  { _id: false },
);

const reviewMonthlyEntrySchema = new Schema(
  {
    monthEndDate: {
      type: Date,
      required: true,
    },
    Task: {
      type: [reviewSubTaskSchema],
      default: [],
    },
  },
  { _id: false },
);

const reviewTaskSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    TaskId: {
      type: Schema.Types.ObjectId,
      ref: "AddTask",
      required: true,
    },
    currentMonthAndYear: {
      type: String,
      required: true,
    },
    DailyTasks: {
      type: [reviewDailyEntrySchema],
      required: true,
      default: [],
    },
    WeeklyTasks: {
      type: [reviewWeeklyEntrySchema],
      required: true,
      default: [],
    },
    MonthlyTasks: {
      type: reviewMonthlyEntrySchema,
      required: true,
    },
  },
  { timestamps: true },
);

reviewTaskSchema.index({ userId: 1, currentMonthAndYear: 1 }, { unique: true });

export const ReviewTask = model("ReviewTask", reviewTaskSchema);
