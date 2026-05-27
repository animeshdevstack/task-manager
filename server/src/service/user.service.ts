import mongoose from "mongoose";
import { User } from "../model/user.model";

const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_RESULTS = 20;

const SearchUsersByEmailService = async (
  query: string,
  excludeUserId: string,
): Promise<
  { _id: mongoose.Types.ObjectId; Fname: string; Lname: string; email: string }[]
> => {
  const trimmed = query.trim();
  if (trimmed.length < MIN_SEARCH_LENGTH) {
    return [];
  }

  const excludeId = new mongoose.Types.ObjectId(excludeUserId);
  const users = await User.find({
    _id: { $ne: excludeId },
    email: { $regex: trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
  })
    .select("Fname Lname email")
    .limit(MAX_SEARCH_RESULTS)
    .lean()
    .exec();

  return users as {
    _id: mongoose.Types.ObjectId;
    Fname: string;
    Lname: string;
    email: string;
  }[];
};

export { SearchUsersByEmailService, MIN_SEARCH_LENGTH };
