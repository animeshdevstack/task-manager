import mongoose from "mongoose";

type ReviewLike = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  TaskId: mongoose.Types.ObjectId;
  currentMonthAndYear?: string | null;
  DailyTasks?: { Task?: { isCompleted?: boolean }[] }[];
  WeeklyTasks?: { Task?: { isCompleted?: boolean }[] }[];
  MonthlyTasks?: { Task?: { isCompleted?: boolean }[] };
  updatedAt?: Date;
  createdAt?: Date;
};

function countCompletions(review: ReviewLike): number {
  let count = 0;
  for (const day of review.DailyTasks ?? []) {
    for (const t of day.Task ?? []) {
      if (t.isCompleted) count += 1;
    }
  }
  for (const week of review.WeeklyTasks ?? []) {
    for (const t of week.Task ?? []) {
      if (t.isCompleted) count += 1;
    }
  }
  for (const t of review.MonthlyTasks?.Task ?? []) {
    if (t.isCompleted) count += 1;
  }
  return count;
}

function pickKeeper<T extends ReviewLike>(docs: T[]): T {
  return [...docs].sort((a, b) => {
    const aDone = countCompletions(a);
    const bDone = countCompletions(b);
    if (bDone !== aDone) return bDone - aDone;
    const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
    const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
    return bTime - aTime;
  })[0]!;
}

/**
 * Backfill currentMonthAndYear, dedupe per user/month, and collapse orphan null-month rows
 * so the unique index on (userId, currentMonthAndYear) can be created.
 */
export async function migrateReviewTasksForUniqueIndex(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;

  const reviewTasks = db.collection("reviewtasks");
  const addTasks = db.collection("addtasks");

  const allReviews = (await reviewTasks.find({}).toArray()) as ReviewLike[];
  const addTaskById = new Map(
    (await addTasks.find({}).toArray()).map((doc) => [
      doc._id.toString(),
      doc as { _id: mongoose.Types.ObjectId; currentMonthAndYear?: string },
    ]),
  );

  let backfilled = 0;
  for (const review of allReviews) {
    if (review.currentMonthAndYear) continue;
    const plan = addTaskById.get(review.TaskId?.toString?.() ?? String(review.TaskId));
    if (!plan?.currentMonthAndYear) continue;

    await reviewTasks.updateOne(
      { _id: review._id },
      { $set: { currentMonthAndYear: plan.currentMonthAndYear } },
    );
    review.currentMonthAndYear = plan.currentMonthAndYear;
    backfilled += 1;
  }

  if (backfilled > 0) {
    console.log(`Review migration: backfilled currentMonthAndYear on ${backfilled} document(s).`);
  }

  const refreshed = (await reviewTasks
    .find({ currentMonthAndYear: { $exists: true, $ne: null } })
    .toArray()) as ReviewLike[];

  const groups = new Map<string, ReviewLike[]>();
  for (const review of refreshed) {
    const month = review.currentMonthAndYear;
    if (!month) continue;
    const key = `${review.userId.toString()}::${month}`;
    const list = groups.get(key) ?? [];
    list.push(review);
    groups.set(key, list);
  }

  let removed = 0;
  for (const [key, docs] of groups) {
    if (docs.length <= 1) continue;

    const keeper = pickKeeper(docs);
    const removeIds = docs
      .filter((d) => d._id.toString() !== keeper._id.toString())
      .map((d) => d._id);

    const [userId, month] = key.split("::");
    const canonicalPlan = await addTasks.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      currentMonthAndYear: month,
    });

    if (canonicalPlan) {
      await reviewTasks.updateOne(
        { _id: keeper._id },
        {
          $set: {
            TaskId: canonicalPlan._id,
            currentMonthAndYear: month,
          },
        },
      );
    }

    const result = await reviewTasks.deleteMany({ _id: { $in: removeIds } });
    removed += result.deletedCount ?? 0;
  }

  if (removed > 0) {
    console.log(`Review migration: removed ${removed} duplicate review document(s).`);
  }

  const stillNull = (await reviewTasks
    .find({
      $or: [
        { currentMonthAndYear: null },
        { currentMonthAndYear: { $exists: false } },
      ],
    })
    .toArray()) as ReviewLike[];

  if (stillNull.length > 0) {
    const byUser = new Map<string, ReviewLike[]>();
    for (const review of stillNull) {
      const uid = review.userId.toString();
      const list = byUser.get(uid) ?? [];
      list.push(review);
      byUser.set(uid, list);
    }

    let orphanRemoved = 0;
    for (const docs of byUser.values()) {
      if (docs.length <= 1) {
        console.warn(
          `Review migration: orphaned review ${docs[0]!._id} has no month (TaskId ${docs[0]!.TaskId}); delete manually or re-link to an addtask.`,
        );
        continue;
      }

      const keeper = pickKeeper(docs);
      const removeIds = docs
        .filter((d) => d._id.toString() !== keeper._id.toString())
        .map((d) => d._id);
      const result = await reviewTasks.deleteMany({ _id: { $in: removeIds } });
      orphanRemoved += result.deletedCount ?? 0;
    }

    if (orphanRemoved > 0) {
      console.log(
        `Review migration: removed ${orphanRemoved} orphan review(s) with missing month (kept one per user for manual cleanup).`,
      );
    }
  }
}
