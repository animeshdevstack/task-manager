import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  SearchUsers,
  GetMyFollow,
  RequestFollow,
  AcceptFollow,
  RejectFollow,
  UnfollowOrCancel,
  RemoveFollower,
  GetSharedAddTask,
  GetSharedReviewTask,
} from "../controller/follow.controller";

const followRouter = Router();

followRouter.use(authMiddleware);

followRouter.get("/users/search", SearchUsers);
followRouter.get("/me", GetMyFollow);
followRouter.post("/request/:targetUserId", RequestFollow);
followRouter.post("/accept/:followerUserId", AcceptFollow);
followRouter.post("/reject/:followerUserId", RejectFollow);
followRouter.delete("/follower/:followerUserId", RemoveFollower);
followRouter.delete("/:otherUserId", UnfollowOrCancel);
followRouter.get("/:targetUserId/add-tasks", GetSharedAddTask);
followRouter.get("/:targetUserId/review-tasks", GetSharedReviewTask);

export default followRouter;
