import { Router } from "express";
import { authMiddleware, requireRoles } from "../middleware/auth.middleware";
import {
  CreateSupportUser,
  ListSupportUsers,
  PatchSupportUser,
  ListUsers,
} from "../controller/admin.controller";

const adminRouter = Router();

adminRouter.use(authMiddleware, requireRoles("admin"));

adminRouter.post("/support-users", CreateSupportUser);
adminRouter.get("/support-users", ListSupportUsers);
adminRouter.patch("/support-users/:id", PatchSupportUser);
adminRouter.get("/users", ListUsers);

export default adminRouter;
