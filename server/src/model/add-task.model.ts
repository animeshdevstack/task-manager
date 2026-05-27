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
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

export const AddTask = model("AddTask", addTaskSchema);
