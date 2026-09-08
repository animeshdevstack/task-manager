import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { User } from "../model/user.model";

const MAX_RESULTS = 50;
const MIN_SEARCH = 2;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const CreateSupportUserService = async (data: {
  Fname: string;
  Lname: string;
  email: string;
  password: string;
}): Promise<unknown> => {
  const email = data.email.trim().toLowerCase();
  if (!data.Fname?.trim() || !data.Lname?.trim() || !email || !data.password) {
    throw new Error("Fname, Lname, email, and password are required");
  }
  if (data.password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const existing = await User.findOne({ email });
  if (existing) {
    throw new Error("User already exists");
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await User.create({
    Fname: data.Fname.trim(),
    Lname: data.Lname.trim(),
    email,
    password: passwordHash,
    role: "support",
    emailVerified: true,
    isActive: true,
  });

  return {
    id: user._id.toString(),
    Fname: user.Fname,
    Lname: user.Lname,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
};

const ListSupportUsersService = async (): Promise<unknown[]> => {
  const users = await User.find({ role: "support" })
    .select("Fname Lname email role isActive createdAt updatedAt")
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  return users.map((u) => ({
    id: u._id.toString(),
    Fname: u.Fname,
    Lname: u.Lname,
    email: u.email,
    role: u.role,
    isActive: u.isActive !== false,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }));
};

const PatchSupportUserService = async (
  id: string,
  data: { isActive?: boolean; Fname?: string; Lname?: string },
): Promise<unknown> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid support user id");
  }

  const user = await User.findOne({ _id: id, role: "support" });
  if (!user) {
    throw new Error("Support user not found");
  }

  if (typeof data.isActive === "boolean") {
    user.isActive = data.isActive;
  }
  if (typeof data.Fname === "string" && data.Fname.trim()) {
    user.Fname = data.Fname.trim();
  }
  if (typeof data.Lname === "string" && data.Lname.trim()) {
    user.Lname = data.Lname.trim();
  }

  await user.save();

  return {
    id: user._id.toString(),
    Fname: user.Fname,
    Lname: user.Lname,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
};

const SearchAppUsersService = async (query: string): Promise<unknown[]> => {
  const trimmed = query.trim();
  const filter: Record<string, unknown> = { role: "user" };

  if (trimmed.length >= MIN_SEARCH) {
    const rx = new RegExp(escapeRegex(trimmed), "i");
    filter.$or = [{ email: rx }, { Fname: rx }, { Lname: rx }];
  }

  const users = await User.find(filter)
    .select("Fname Lname email role isActive createdAt")
    .sort({ createdAt: -1 })
    .limit(MAX_RESULTS)
    .lean()
    .exec();

  return users.map((u) => ({
    id: u._id.toString(),
    Fname: u.Fname,
    Lname: u.Lname,
    email: u.email,
    role: u.role,
    isActive: u.isActive !== false,
    createdAt: u.createdAt,
  }));
};

export {
  CreateSupportUserService,
  ListSupportUsersService,
  PatchSupportUserService,
  SearchAppUsersService,
  MIN_SEARCH,
};
