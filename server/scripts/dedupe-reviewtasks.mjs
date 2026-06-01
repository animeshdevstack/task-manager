/**
 * One-time cleanup: keep one reviewtasks doc per (userId, currentMonthAndYear),
 * backfill month from addtasks when missing, delete duplicates.
 *
 * Usage (from server/):
 *   node scripts/dedupe-reviewtasks.mjs
 *   node scripts/dedupe-reviewtasks.mjs --dry-run
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/task-planner";
const dryRun = process.argv.includes("--dry-run");

function countCompletions(review) {
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

function pickKeeper(docs) {
  return [...docs].sort((a, b) => {
    const aDone = countCompletions(a);
    const bDone = countCompletions(b);
    if (bDone !== aDone) return bDone - aDone;
    const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
    const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
    return bTime - aTime;
  })[0];
}

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const reviewTasks = db.collection("reviewtasks");
  const addTasks = db.collection("addtasks");

  const allReviews = await reviewTasks.find({}).toArray();
  const addTaskById = new Map(
    (await addTasks.find({}).toArray()).map((doc) => [doc._id.toString(), doc]),
  );

  let backfilled = 0;
  for (const review of allReviews) {
    if (review.currentMonthAndYear) continue;
    const plan = addTaskById.get(review.TaskId?.toString?.() ?? String(review.TaskId));
    if (!plan?.currentMonthAndYear) {
      console.warn(
        `Skip backfill review ${review._id}: no addtask month for TaskId ${review.TaskId}`,
      );
      continue;
    }
    console.log(
      `${dryRun ? "[dry-run] " : ""}Backfill review ${review._id} → month ${plan.currentMonthAndYear}`,
    );
    if (!dryRun) {
      await reviewTasks.updateOne(
        { _id: review._id },
        { $set: { currentMonthAndYear: plan.currentMonthAndYear } },
      );
      review.currentMonthAndYear = plan.currentMonthAndYear;
    } else {
      review.currentMonthAndYear = plan.currentMonthAndYear;
    }
    backfilled += 1;
  }

  const reviewsWithMonth = dryRun
    ? allReviews.filter((r) => r.currentMonthAndYear)
    : await reviewTasks.find({ currentMonthAndYear: { $exists: true, $ne: null } }).toArray();

  const groups = new Map();
  for (const review of reviewsWithMonth) {
    const month = review.currentMonthAndYear;
    if (!month) continue;
    const key = `${review.userId.toString()}::${month}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(review);
  }

  let removed = 0;
  for (const [key, docs] of groups) {
    if (docs.length <= 1) continue;

    const keeper = pickKeeper(docs);
    const removeIds = docs.filter((d) => d._id.toString() !== keeper._id.toString()).map((d) => d._id);
    const [userId, month] = key.split("::");

    const canonicalPlan = await addTasks.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      currentMonthAndYear: month,
    });

    console.log(
      `${dryRun ? "[dry-run] " : ""}userId=${userId} month=${month}: keep review ${keeper._id} (${countCompletions(keeper)} completions), remove ${removeIds.length}`,
    );

    if (!dryRun) {
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
    } else {
      removed += removeIds.length;
    }
  }

  console.log(
    `${dryRun ? "[dry-run] " : ""}Backfilled ${backfilled} review(s); ${dryRun ? "would remove" : "removed"} ${removed} duplicate(s).`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
