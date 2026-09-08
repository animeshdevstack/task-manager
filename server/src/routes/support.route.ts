import { Router } from "express";
import { authMiddleware, requireRoles } from "../middleware/auth.middleware";
import {
  SearchUsers,
  GetTargetUser,
  GetTargetAddTasks,
  GetTargetReviewTasks,
  GetTargetReviewTaskById,
  PatchTargetReviewTask,
  CreateTicket,
  ListMyTickets,
  ListTickets,
  GetTicketById,
  PatchTicket,
  CancelMyTicket,
} from "../controller/support.controller";

const supportRouter = Router();

// Any authenticated user can create / list / cancel own tickets
supportRouter.post("/tickets", authMiddleware, CreateTicket);
supportRouter.get("/tickets/mine", authMiddleware, ListMyTickets);
supportRouter.patch("/tickets/:id/cancel", authMiddleware, CancelMyTicket);

// Support + Admin staff routes
supportRouter.get(
  "/users/search",
  authMiddleware,
  requireRoles("support", "admin"),
  SearchUsers,
);
supportRouter.get(
  "/users/:userId",
  authMiddleware,
  requireRoles("support", "admin"),
  GetTargetUser,
);
supportRouter.get(
  "/users/:userId/add-tasks",
  authMiddleware,
  requireRoles("support", "admin"),
  GetTargetAddTasks,
);
supportRouter.get(
  "/users/:userId/review-tasks",
  authMiddleware,
  requireRoles("support", "admin"),
  GetTargetReviewTasks,
);
supportRouter.get(
  "/users/:userId/review-tasks/:id",
  authMiddleware,
  requireRoles("support", "admin"),
  GetTargetReviewTaskById,
);
supportRouter.patch(
  "/users/:userId/review-tasks/:id",
  authMiddleware,
  requireRoles("support", "admin"),
  PatchTargetReviewTask,
);
supportRouter.get(
  "/tickets",
  authMiddleware,
  requireRoles("support", "admin"),
  ListTickets,
);
supportRouter.get(
  "/tickets/:id",
  authMiddleware,
  requireRoles("support", "admin"),
  GetTicketById,
);
supportRouter.patch(
  "/tickets/:id",
  authMiddleware,
  requireRoles("support", "admin"),
  PatchTicket,
);

export default supportRouter;
