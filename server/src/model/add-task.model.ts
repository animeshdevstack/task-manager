import { Schema, model } from "mongoose";

const taskNameItemSchema = new Schema(
  {
    taskName: {
      type: String,
      required: true,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true },
);

const datedTaskEntrySchema = new Schema(
  {
    date: {
      type: String,
      required: true,
    },
    tasks: {
      type: [taskNameItemSchema],
      default: [],
    },
  },
  { _id: false },
);

const addTaskSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    currentMonthAndYear: {
      type: String,
      required: true,
    },
    DailyTasks: {
      type: [taskNameItemSchema],
      required: true,
    },
    WeeklyTasks: {
      type: [taskNameItemSchema],
      required: true,
    },
    MonthlyTasks: {
      type: [taskNameItemSchema],
      required: true,
    },
    DatedTasks: {
      type: [datedTaskEntrySchema],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

addTaskSchema.index({ userId: 1, currentMonthAndYear: 1 }, { unique: true });

export const AddTask = model("AddTask", addTaskSchema);
