import { Request, Response } from "express";
import {
  SearchUsersForSupportService,
  GetTargetUserAddTasksService,
  GetTargetUserReviewTasksService,
  GetTargetUserReviewTaskByIdService,
  PatchTargetUserReviewService,
  CreateSupportTicketService,
  ListMyTicketsService,
  ListTicketsService,
  GetTicketByIdService,
  ResolveTicketService,
  CancelMyTicketService,
  assertTargetUser,
} from "../service/support.service";
import { getUserTimezone } from "../helper/user-timezone.helper";

const getAuthUserId = (req: Request, res: Response): string | null => {
  const userId = req.auth?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return null;
  }
  return userId;
};

const SearchUsers = async (req: Request, res: Response) => {
  try {
    if (!getAuthUserId(req, res)) return;
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const data = await SearchUsersForSupportService(q);
    res.status(200).json({ success: true, message: "Users found", data });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
};

const GetTargetUser = async (req: Request, res: Response) => {
  try {
    if (!getAuthUserId(req, res)) return;
    const userId = String(req.params.userId ?? "");
    const user = await assertTargetUser(userId);
    res.status(200).json({
      success: true,
      message: "User fetched",
      data: {
        id: user._id.toString(),
        Fname: user.Fname,
        Lname: user.Lname,
        email: user.email,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(message.includes("not found") ? 404 : 400).json({
      success: false,
      message,
    });
  }
};

const parseIncludePrivate = (req: Request): boolean =>
  req.query.includePrivate === "true" || req.query.includePrivate === "1";

const GetTargetAddTasks = async (req: Request, res: Response) => {
  try {
    if (!getAuthUserId(req, res)) return;
    const userId = String(req.params.userId ?? "");
    const month = typeof req.query.month === "string" ? req.query.month : undefined;
    const data = await GetTargetUserAddTasksService(
      userId,
      month,
      parseIncludePrivate(req),
    );
    res.status(200).json({ success: true, message: "Tasks fetched", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(message.includes("not found") ? 404 : 400).json({
      success: false,
      message,
    });
  }
};

const GetTargetReviewTasks = async (req: Request, res: Response) => {
  try {
    if (!getAuthUserId(req, res)) return;
    const userId = String(req.params.userId ?? "");
    const month = typeof req.query.month === "string" ? req.query.month : undefined;
    const data = await GetTargetUserReviewTasksService(
      userId,
      month,
      parseIncludePrivate(req),
    );
    res.status(200).json({ success: true, message: "Review tasks fetched", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(message.includes("not found") ? 404 : 400).json({
      success: false,
      message,
    });
  }
};

const GetTargetReviewTaskById = async (req: Request, res: Response) => {
  try {
    if (!getAuthUserId(req, res)) return;
    const userId = String(req.params.userId ?? "");
    const id = String(req.params.id ?? "");
    const data = await GetTargetUserReviewTaskByIdService(
      userId,
      id,
      parseIncludePrivate(req),
    );
    res.status(200).json({ success: true, message: "Review task fetched", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(message.includes("not found") ? 404 : 400).json({
      success: false,
      message,
    });
  }
};

const PatchTargetReviewTask = async (req: Request, res: Response) => {
  try {
    const actorId = getAuthUserId(req, res);
    if (!actorId) return;
    const role = req.auth?.role;
    if (role !== "admin" && role !== "support") {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    const targetUserId = String(req.params.userId ?? "");
    const reviewId = String(req.params.id ?? "");
    const { type, dateYmd, date, subTaskId, isCompleted, note } = req.body ?? {};

    if (!type || !subTaskId || typeof isCompleted !== "boolean") {
      res.status(400).json({
        success: false,
        message: "type, subTaskId, and isCompleted are required",
      });
      return;
    }

    const data = await PatchTargetUserReviewService({
      actorId,
      actorRole: role,
      targetUserId,
      reviewId,
      type,
      dateYmd,
      date,
      subTaskId: String(subTaskId),
      isCompleted,
      note,
      userTimezone: getUserTimezone(req),
    });

    res.status(200).json({
      success: true,
      message: "Review task updated successfully",
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(message.includes("not found") ? 404 : 400).json({
      success: false,
      message,
    });
  }
};

const CreateTicket = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req, res);
    if (!userId) return;

    let tasks = Array.isArray(req.body?.tasks) ? req.body.tasks : null;
    // Legacy single-task payload
    if (!tasks?.length && req.body?.subTaskId) {
      tasks = [
        {
          subTaskId: String(req.body.subTaskId),
          subTaskName: String(req.body.subTaskName ?? "Task"),
        },
      ];
    }

    const data = await CreateSupportTicketService({
      userId,
      reviewTaskId: String(req.body?.reviewTaskId ?? ""),
      type: req.body?.type,
      dateYmd: String(req.body?.dateYmd ?? ""),
      tasks: (tasks ?? []).map(
        (t: { subTaskId?: string; subTaskName?: string }) => ({
          subTaskId: String(t.subTaskId ?? ""),
          subTaskName: String(t.subTaskName ?? "Task"),
        }),
      ),
      message: String(req.body?.message ?? ""),
    });

    res.status(201).json({
      success: true,
      message: "Support ticket created",
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(message.includes("not found") ? 404 : 400).json({
      success: false,
      message,
    });
  }
};

const ListMyTickets = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req, res);
    if (!userId) return;
    const data = await ListMyTicketsService(userId);
    res.status(200).json({ success: true, message: "Tickets fetched", data });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
};

const ListTickets = async (req: Request, res: Response) => {
  try {
    if (!getAuthUserId(req, res)) return;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const data = await ListTicketsService(status);
    res.status(200).json({ success: true, message: "Tickets fetched", data });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
};

const GetTicketById = async (req: Request, res: Response) => {
  try {
    if (!getAuthUserId(req, res)) return;
    const data = await GetTicketByIdService(String(req.params.id ?? ""));
    res.status(200).json({ success: true, message: "Ticket fetched", data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(message.includes("not found") ? 404 : 400).json({
      success: false,
      message,
    });
  }
};

const PatchTicket = async (req: Request, res: Response) => {
  try {
    const actorId = getAuthUserId(req, res);
    if (!actorId) return;
    const role = req.auth?.role;
    if (role !== "admin" && role !== "support") {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    const status = req.body?.status;
    if (status !== "resolved" && status !== "rejected") {
      res.status(400).json({
        success: false,
        message: "status must be resolved or rejected",
      });
      return;
    }

    const data = await ResolveTicketService({
      ticketId: String(req.params.id ?? ""),
      actorId,
      actorRole: role,
      status,
      resolutionNote: req.body?.resolutionNote,
      markComplete: req.body?.markComplete === true,
      userTimezone: getUserTimezone(req),
    });

    res.status(200).json({
      success: true,
      message: "Ticket updated",
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(message.includes("not found") ? 404 : 400).json({
      success: false,
      message,
    });
  }
};

const CancelMyTicket = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req, res);
    if (!userId) return;

    const data = await CancelMyTicketService(
      userId,
      String(req.params.id ?? ""),
    );

    res.status(200).json({
      success: true,
      message: "Ticket revoked",
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message === "Forbidden" ? 403 : message.includes("not found") ? 404 : 400;
    res.status(status).json({ success: false, message });
  }
};

export {
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
};
