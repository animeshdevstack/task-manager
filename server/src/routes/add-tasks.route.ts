import { Router } from "express";
import {
  AddTask,
  GetTasks,
  GetTaskById,
  UpdateTask,
  DeleteTask,
} from "../controller/addTask.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const addTasksRouter = Router();

addTasksRouter.use(authMiddleware);

addTasksRouter.post("/add-tasks", AddTask);
addTasksRouter.get("/get-tasks", GetTasks);
addTasksRouter.get("/get-task-by-id/:id", GetTaskById);
addTasksRouter.put("/update-task/:id", UpdateTask);
addTasksRouter.delete("/delete-task/:id", DeleteTask);

export default addTasksRouter;
