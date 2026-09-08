import { Request, Response } from "express";
import {
  CreateSupportUserService,
  ListSupportUsersService,
  PatchSupportUserService,
  SearchAppUsersService,
} from "../service/admin.service";

const CreateSupportUser = async (req: Request, res: Response) => {
  try {
    const data = await CreateSupportUserService(req.body);
    res.status(201).json({
      success: true,
      message: "Support user created successfully",
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("already exists") ? 409 : 400;
    res.status(status).json({ success: false, message });
  }
};

const ListSupportUsers = async (_req: Request, res: Response) => {
  try {
    const data = await ListSupportUsersService();
    res.status(200).json({
      success: true,
      message: "Support users fetched successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
};

const PatchSupportUser = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id ?? "");
    const data = await PatchSupportUserService(id, req.body ?? {});
    res.status(200).json({
      success: true,
      message: "Support user updated successfully",
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("not found") ? 404 : 400;
    res.status(status).json({ success: false, message });
  }
};

const ListUsers = async (req: Request, res: Response) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const data = await SearchAppUsersService(q);
    res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
};

export { CreateSupportUser, ListSupportUsers, PatchSupportUser, ListUsers };
