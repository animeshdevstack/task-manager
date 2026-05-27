import { Schema, model } from "mongoose";

export const FOLLOW_STATUSES = ["pending", "accepted", "rejected"] as const;
export type FollowStatus = (typeof FOLLOW_STATUSES)[number];

const followUserEntrySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: FOLLOW_STATUSES,
      required: true,
    },
  },
  { _id: false },
);

const userFollowSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    followerList: {
      type: [followUserEntrySchema],
      default: [],
    },
    followingList: {
      type: [followUserEntrySchema],
      default: [],
    },
  },
  { timestamps: true },
);

export const UserFollow = model("UserFollow", userFollowSchema);
