import { Request, Response } from "express";
import {
  RequestFollowService,
  AcceptFollowService,
  RejectFollowService,
  UnfollowOrCancelService,
  RemoveFollowerService,
  GetMyFollowService,
} from "../service/follow.service";
import { SearchUsersByEmailService, MIN_SEARCH_LENGTH } from "../service/user.service";
import {
  GetSharedAddTaskService,
  GetSharedReviewTaskService,
} from "../service/shared-tasks.service";

const paramId = (value: string | string[] | undefined): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value[0]) return value[0];
  return "";
};

const getAuthUserId = (req: Request, res: Response): string | null => {
  const userId = req.auth?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return null;
  }
  return userId;
};

const mapErrorStatus = (message: string): number => {
  if (message.includes("not found")) return 404;
  if (
    message.includes("Not authorized") ||
    message.includes("Cannot view your own")
  ) {
    return 403;
  }
  if (
    message.includes("Already following") ||
    message.includes("already pending") ||
    message.includes("Cannot follow yourself") ||
    message.includes("No pending")
  ) {
    return 400;
  }
  return 500;
};

const SearchUsers = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req, res);
    if (!userId) return;

    const q = typeof req.query.q === "string" ? req.query.q : "";
    if (q.trim().length < MIN_SEARCH_LENGTH) {
      res.status(200).json({ success: true, data: [] });
      return;
    }

    const users = await SearchUsersByEmailService(q, userId);
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
};

const GetMyFollow = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req, res);
    if (!userId) return;

    const data = await GetMyFollowService(userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
};

const RequestFollow = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req, res);
    if (!userId) return;

    const targetUserId = paramId(req.params.targetUserId);
    if (!targetUserId) {
      res.status(400).json({ success: false, message: "Invalid target user id" });
      return;
    }
    await RequestFollowService(userId, targetUserId);
    res.status(200).json({ success: true, message: "Follow request sent" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(mapErrorStatus(message)).json({ success: false, message });
  }
};

const AcceptFollow = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req, res);
    if (!userId) return;

    const followerUserId = paramId(req.params.followerUserId);
    if (!followerUserId) {
      res.status(400).json({ success: false, message: "Invalid follower user id" });
      return;
    }
    await AcceptFollowService(userId, followerUserId);
    res.status(200).json({ success: true, message: "Follow request accepted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(mapErrorStatus(message)).json({ success: false, message });
  }
};

const RejectFollow = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req, res);
    if (!userId) return;

    const followerUserId = paramId(req.params.followerUserId);
    if (!followerUserId) {
      res.status(400).json({ success: false, message: "Invalid follower user id" });
      return;
    }
    await RejectFollowService(userId, followerUserId);
    res.status(200).json({ success: true, message: "Follow request rejected" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(mapErrorStatus(message)).json({ success: false, message });
  }
};

const UnfollowOrCancel = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req, res);
    if (!userId) return;

    const otherUserId = paramId(req.params.otherUserId);
    if (!otherUserId) {
      res.status(400).json({ success: false, message: "Invalid user id" });
      return;
    }
    await UnfollowOrCancelService(userId, otherUserId);
    res.status(200).json({ success: true, message: "Follow relationship removed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(mapErrorStatus(message)).json({ success: false, message });
  }
};

const RemoveFollower = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req, res);
    if (!userId) return;

    const followerUserId = paramId(req.params.followerUserId);
    if (!followerUserId) {
      res.status(400).json({ success: false, message: "Invalid follower user id" });
      return;
    }

    await RemoveFollowerService(userId, followerUserId);
    res.status(200).json({ success: true, message: "Follower removed successfully" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(mapErrorStatus(message)).json({ success: false, message });
  }
};

const GetSharedAddTask = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req, res);
    if (!userId) return;

    const targetUserId = paramId(req.params.targetUserId);
    if (!targetUserId) {
      res.status(400).json({ success: false, message: "Invalid target user id" });
      return;
    }
    const month = typeof req.query.month === "string" ? req.query.month : "";
    if (!/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ success: false, message: "Invalid month format (YYYY-MM)" });
      return;
    }

    const data = await GetSharedAddTaskService(userId, targetUserId, month);
    res.status(200).json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(mapErrorStatus(message)).json({ success: false, message });
  }
};

const GetSharedReviewTask = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req, res);
    if (!userId) return;

    const targetUserId = paramId(req.params.targetUserId);
    if (!targetUserId) {
      res.status(400).json({ success: false, message: "Invalid target user id" });
      return;
    }
    const month = typeof req.query.month === "string" ? req.query.month : "";
    if (!/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ success: false, message: "Invalid month format (YYYY-MM)" });
      return;
    }

    const data = await GetSharedReviewTaskService(userId, targetUserId, month);
    res.status(200).json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(mapErrorStatus(message)).json({ success: false, message });
  }
};

export {
  SearchUsers,
  GetMyFollow,
  RequestFollow,
  AcceptFollow,
  RejectFollow,
  UnfollowOrCancel,
  RemoveFollower,
  GetSharedAddTask,
  GetSharedReviewTask,
};
