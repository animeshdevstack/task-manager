import { Request, Response } from "express";
import {
  GetReviewTasksService,
  GetReviewTaskByIdService,
  PatchReviewTaskCompletionService,
} from "../service/review-task.service";

const GetReviewTasks = async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const pageNum = Number(req.query.page);
    const limitNum = Number(req.query.limit);
    const data = await GetReviewTasksService(userId, {
      page: Number.isFinite(pageNum) && pageNum >= 1 ? pageNum : undefined,
      limit: Number.isFinite(limitNum) && limitNum >= 1 ? limitNum : undefined,
    });
    res.status(200).json({
      success: true,
      message: "Review tasks fetched successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error,
    });
  }
};

const GetReviewTaskById = async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const { id } = req.params;
    const data = await GetReviewTaskByIdService(id as string, userId);
    res.status(200).json({
      success: true,
      message: "Review task fetched successfully",
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message === "Review task not found" ? 404 : 500;
    res.status(status).json({
      success: false,
      message,
      error: status === 500 ? error : undefined,
    });
  }
};

const PatchReviewTask = async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const { id } = req.params;
    const { type, date, subTaskId, isCompleted } = req.body;

    if (!type || !date || !subTaskId || typeof isCompleted !== "boolean") {
      res.status(400).json({
        success: false,
        message: "type, date, subTaskId, and isCompleted are required",
      });
      return;
    }

    const data = await PatchReviewTaskCompletionService(id as string, userId, {
      type,
      date,
      subTaskId,
      isCompleted,
    });
    res.status(200).json({
      success: true,
      message: "Review task updated successfully",
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status =
      message === "Review task not found" ||
      message === "Sub task or date slot not found" ||
      message === "Invalid date" ||
      message.startsWith("Invalid type")
        ? 400
        : 500;
    res.status(status).json({
      success: false,
      message,
      error: status === 500 ? error : undefined,
    });
  }
};

export { GetReviewTasks, GetReviewTaskById, PatchReviewTask };
