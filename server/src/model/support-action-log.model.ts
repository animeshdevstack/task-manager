import { Schema, model } from "mongoose";

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
    subTaskId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    isCompleted: {
      type: Boolean,
      required: true,
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
