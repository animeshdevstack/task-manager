import { Schema, model } from "mongoose";

const actionLogTaskSchema = new Schema(
  {
    subTaskId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    isCompleted: {
      type: Boolean,
      required: true,
    },
  },
  { _id: false },
);

const supportActionLogSchema = new Schema(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actorRole: {
      type: String,
      required: true,
      enum: ["admin", "support"],
    },
    targetUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reviewTaskId: {
      type: Schema.Types.ObjectId,
      ref: "ReviewTask",
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["daily", "weekly", "monthly"],
    },
    dateYmd: {
      type: String,
      required: true,
      trim: true,
    },
    tasks: {
      type: [actionLogTaskSchema],
      required: true,
      validate: {
        validator: (v: unknown[]) => Array.isArray(v) && v.length > 0,
        message: "At least one task is required",
      },
    },
    /** @deprecated legacy single-task fields — kept for old documents */
    subTaskId: {
      type: Schema.Types.ObjectId,
      required: false,
    },
    /** @deprecated legacy single-task fields — kept for old documents */
    isCompleted: {
      type: Boolean,
      required: false,
    },
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: "SupportTicket",
      required: false,
    },
    note: {
      type: String,
      required: false,
      trim: true,
      maxlength: 2000,
    },
  },
  { timestamps: true },
);

supportActionLogSchema.index({ createdAt: -1 });

export const SupportActionLog = model("SupportActionLog", supportActionLogSchema);
