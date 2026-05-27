import mongoose from "mongoose";
import { User } from "../model/user.model";
import { UserFollow, FollowStatus } from "../model/user-follow.model";

const toObjectId = (id: string): mongoose.Types.ObjectId => new mongoose.Types.ObjectId(id);

type FollowEntry = { userId: mongoose.Types.ObjectId; status: FollowStatus };

const getOrCreateUserFollow = async (userId: string) => {
  const oid = toObjectId(userId);
  let doc = await UserFollow.findOne({ userId: oid });
  if (!doc) {
    doc = await UserFollow.create({
      userId: oid,
      followerList: [],
      followingList: [],
    });
  }
  return doc;
};

const findEntryIndex = (list: FollowEntry[], otherUserId: string): number =>
  list.findIndex((e) => e.userId.toString() === otherUserId);

const populateUsers = async (entries: FollowEntry[]) => {
  if (!entries.length) return [];

  const userIds = entries.map((e) => e.userId);
  const users = await User.find({ _id: { $in: userIds } })
    .select("Fname Lname email")
    .lean()
    .exec();

  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  return entries.map((e) => {
    const u = userMap.get(e.userId.toString());
    return {
      userId: e.userId,
      status: e.status,
      Fname: u?.Fname ?? "",
      Lname: u?.Lname ?? "",
      email: u?.email ?? "",
    };
  });
};

const RequestFollowService = async (
  requesterId: string,
  targetUserId: string,
): Promise<void> => {
  if (requesterId === targetUserId) {
    throw new Error("Cannot follow yourself");
  }

  const targetExists = await User.exists({ _id: targetUserId });
  if (!targetExists) {
    throw new Error("User not found");
  }

  const requesterDoc = await getOrCreateUserFollow(requesterId);
  const targetDoc = await getOrCreateUserFollow(targetUserId);

  const followingIdx = findEntryIndex(requesterDoc.followingList, targetUserId);
  const followerIdx = findEntryIndex(targetDoc.followerList, requesterId);

  if (followingIdx >= 0) {
    const entry = requesterDoc.followingList[followingIdx];
    if (!entry) {
      throw new Error("Invalid follow state");
    }
    if (entry.status === "accepted") {
      throw new Error("Already following this user");
    }
    if (entry.status === "pending") {
      throw new Error("Follow request already pending");
    }
    entry.status = "pending";
    if (followerIdx >= 0) {
      const followerEntry = targetDoc.followerList[followerIdx];
      if (followerEntry) followerEntry.status = "pending";
    } else {
      targetDoc.followerList.push({
        userId: toObjectId(requesterId),
        status: "pending",
      });
    }
  } else {
    requesterDoc.followingList.push({
      userId: toObjectId(targetUserId),
      status: "pending",
    });
    if (followerIdx >= 0) {
      const followerEntry = targetDoc.followerList[followerIdx];
      if (followerEntry) followerEntry.status = "pending";
    } else {
      targetDoc.followerList.push({
        userId: toObjectId(requesterId),
        status: "pending",
      });
    }
  }

  await Promise.all([requesterDoc.save(), targetDoc.save()]);
};

const AcceptFollowService = async (
  followeeId: string,
  followerUserId: string,
): Promise<void> => {
  const followeeDoc = await getOrCreateUserFollow(followeeId);
  const followerDoc = await getOrCreateUserFollow(followerUserId);

  const followerIdx = findEntryIndex(followeeDoc.followerList, followerUserId);
  const followerEntry = followeeDoc.followerList[followerIdx];
  if (!followerEntry || followerEntry.status !== "pending") {
    throw new Error("No pending follow request from this user");
  }

  followerEntry.status = "accepted";

  const followingIdx = findEntryIndex(followerDoc.followingList, followeeId);
  if (followingIdx >= 0) {
    const followingEntry = followerDoc.followingList[followingIdx];
    if (followingEntry) followingEntry.status = "accepted";
  } else {
    followerDoc.followingList.push({
      userId: toObjectId(followeeId),
      status: "accepted",
    });
  }

  await Promise.all([followeeDoc.save(), followerDoc.save()]);
};

const RejectFollowService = async (
  followeeId: string,
  followerUserId: string,
): Promise<void> => {
  const followeeDoc = await getOrCreateUserFollow(followeeId);
  const followerDoc = await getOrCreateUserFollow(followerUserId);

  const followerIdx = findEntryIndex(followeeDoc.followerList, followerUserId);
  const followerEntry = followeeDoc.followerList[followerIdx];
  if (!followerEntry || followerEntry.status !== "pending") {
    throw new Error("No pending follow request from this user");
  }

  followerEntry.status = "rejected";

  const followingIdx = findEntryIndex(followerDoc.followingList, followeeId);
  if (followingIdx >= 0) {
    const followingEntry = followerDoc.followingList[followingIdx];
    if (followingEntry) followingEntry.status = "rejected";
  }

  await Promise.all([followeeDoc.save(), followerDoc.save()]);
};

const UnfollowOrCancelService = async (
  userId: string,
  otherUserId: string,
): Promise<void> => {
  const userDoc = await getOrCreateUserFollow(userId);
  const otherDoc = await getOrCreateUserFollow(otherUserId);

  userDoc.followingList = userDoc.followingList.filter(
    (e) => e.userId.toString() !== otherUserId,
  ) as typeof userDoc.followingList;
  otherDoc.followerList = otherDoc.followerList.filter(
    (e) => e.userId.toString() !== userId,
  ) as typeof otherDoc.followerList;

  await Promise.all([userDoc.save(), otherDoc.save()]);
};

const RemoveFollowerService = async (
  followeeId: string,
  followerUserId: string,
): Promise<void> => {
  const followeeDoc = await getOrCreateUserFollow(followeeId);
  const followerDoc = await getOrCreateUserFollow(followerUserId);

  followeeDoc.followerList = followeeDoc.followerList.filter(
    (e) => e.userId.toString() !== followerUserId,
  ) as typeof followeeDoc.followerList;
  followerDoc.followingList = followerDoc.followingList.filter(
    (e) => e.userId.toString() !== followeeId,
  ) as typeof followerDoc.followingList;

  await Promise.all([followeeDoc.save(), followerDoc.save()]);
};

const GetMyFollowService = async (userId: string) => {
  const doc = await getOrCreateUserFollow(userId);

  const incomingPending = doc.followerList.filter((e) => e.status === "pending");
  const following = doc.followingList.filter((e) => e.status === "accepted");
  const followers = doc.followerList.filter((e) => e.status === "accepted");
  const followingPending = doc.followingList.filter((e) => e.status === "pending");
  const followingRejected = doc.followingList.filter((e) => e.status === "rejected");

  const [incomingPendingUsers, followingUsers, followersUsers, followingPendingUsers] =
    await Promise.all([
      populateUsers(incomingPending),
      populateUsers(following),
      populateUsers(followers),
      populateUsers(followingPending),
    ]);

  return {
    incomingPending: incomingPendingUsers,
    following: followingUsers,
    followers: followersUsers,
    followingPending: followingPendingUsers,
    followingRejected: followingRejected.map((e) => ({
      userId: e.userId,
      status: e.status,
    })),
  };
};

export {
  RequestFollowService,
  AcceptFollowService,
  RejectFollowService,
  UnfollowOrCancelService,
  RemoveFollowerService,
  GetMyFollowService,
};
