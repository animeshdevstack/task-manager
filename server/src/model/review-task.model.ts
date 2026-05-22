import { Schema, model } from "mongoose";

const dailyTaskSchema = new Schema(
  {
    DailyTasks: [
      {
        todayDate: {
          type: Date,
          required: true,
        },
        Task: [
          {
            subTaskId: {
              type: Schema.Types.ObjectId,
              ref: "SubTask",
              required: true,
            },
            subTaskName: {
              type: String,
              required: true,
            },
            isCompleted: {
              type: Boolean,
              required: true,
            },
          },
        ],
      },
    ],
  }
);

const weeklyTaskSchema = new Schema(
  {
    WeeklyTasks: [
      {
        sundayDate: {
          type: Date,
          required: true,
        },
        Task: [
          {
            subTaskId: {
              type: Schema.Types.ObjectId,
              ref: "SubTask",
              required: true,
            },
            subTaskName: {
              type: String,
              required: true,
            },
            isCompleted: {
              type: Boolean,
              required: true,
            },
          },
        ],
      },
    ],
  }
);

const monthlyTaskSchema = new Schema(
  {
    MonthlyTasks: {
        monthEndDate: {
          type: Date,
          required: true,
        },
        Task: [
          {
            subTaskId: {
              type: Schema.Types.ObjectId,
              ref: "SubTask",
              required: true,
            },
            subTaskName: {
              type: String,
              required: true,
            },
            isCompleted: {
              type: Boolean,
              required: true,
            },
          },
        ],
      },
  }
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
    DailyTasks: {
      type: dailyTaskSchema,
      required: true,
    },
    WeeklyTasks: {
      type: weeklyTaskSchema,
      required: true,
    },
    MonthlyTasks: {
      type: monthlyTaskSchema,
      required: true,
    },
  },
  { timestamps: true },
);

export const ReviewTask = model("ReviewTask", reviewTaskSchema);
