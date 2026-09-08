import { Schema, model } from "mongoose";

const ticketTaskSchema = new Schema(
  {
    subTaskId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    subTaskName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
);

const supportTicketSchema = new Schema(
  {
    userId: {
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
      type: [ticketTaskSchema],
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
    subTaskName: {
      type: String,
      required: false,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      required: true,
      enum: ["open", "resolved", "rejected", "cancelled"],
      default: "open",
      index: true,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    resolvedAt: {
      type: Date,
      required: false,
    },
    resolutionNote: {
      type: String,
      required: false,
      trim: true,
      maxlength: 2000,
    },
  },
  { timestamps: true },
);

supportTicketSchema.index({ status: 1, createdAt: -1 });
supportTicketSchema.index({ userId: 1, createdAt: -1 });

export const SupportTicket = model("SupportTicket", supportTicketSchema);
