import { Router } from "express";
import {
  GetReviewTasks,
  GetReviewTaskById,
  PatchReviewTask,
} from "../controller/review-task.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const reviewTaskRouter = Router();

reviewTaskRouter.use(authMiddleware);

reviewTaskRouter.get("/get-user-review-task", GetReviewTasks);
reviewTaskRouter.get("/get-user-review-task-by-id/:id", GetReviewTaskById);
reviewTaskRouter.patch("/update-user-review-task/:id", PatchReviewTask);

export default reviewTaskRouter;
