import { Request, Response } from "express";
import {
  CreateTaskService,
  GetTasksService,
  GetTaskByIdService,
  UpdateTaskService,
  DeleteTaskService,
} from "../service/add-task.service";

const AddTask = async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const data = await CreateTaskService(req.body, userId);
    res.status(201).json({
      success: true,
      message: "Task created successfully",
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

const GetTasks = async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const pageNum = Number(req.query.page);
    const limitNum = Number(req.query.limit);
    const data = await GetTasksService(userId, {
      page: Number.isFinite(pageNum) && pageNum >= 1 ? pageNum : undefined,
      limit: Number.isFinite(limitNum) && limitNum >= 1 ? limitNum : undefined,
    });
    res.status(200).json({
      success: true,
      message: "Tasks fetched successfully",
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

const GetTaskById = async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const { id } = req.params;
    const data = await GetTaskByIdService(id as string, userId);
    res.status(200).json({
      success: true,
      message: "Task fetched successfully",
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

const UpdateTask = async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const { id } = req.params;
    const data = await UpdateTaskService(id as string, req.body, userId);
    res.status(200).json({
      success: true,
      message: "Task updated successfully",
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

const DeleteTask = async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const { id } = req.params;
    const data = await DeleteTaskService(id as string, userId);
    res.status(200).json({
      success: true,
      message: "Task deleted successfully",
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

export { AddTask, GetTasks, GetTaskById, UpdateTask, DeleteTask };
