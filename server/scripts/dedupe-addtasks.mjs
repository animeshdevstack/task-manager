/**
 * One-time cleanup: keep one addtasks doc per (userId, currentMonthAndYear),
 * delete duplicates and their reviewtasks.
 *
 * Usage (from server/):
 *   node scripts/dedupe-addtasks.mjs
 *   node scripts/dedupe-addtasks.mjs --dry-run
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/task-planner";
const dryRun = process.argv.includes("--dry-run");

function pickKeeper(docs) {
  return [...docs].sort((a, b) => {
    const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
    const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
    return bTime - aTime;
  })[0];
}

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const addTasks = db.collection("addtasks");
  const reviewTasks = db.collection("reviewtasks");

  const duplicateGroups = await addTasks
    .aggregate([
      {
        $group: {
          _id: { userId: "$userId", month: "$currentMonthAndYear" },
          count: { $sum: 1 },
          docs: {
            $push: {
              _id: "$_id",
              updatedAt: "$updatedAt",
              createdAt: "$createdAt",
            },
          },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  if (duplicateGroups.length === 0) {
    console.log("No duplicate addtasks groups found.");
    await mongoose.disconnect();
    return;
  }

  console.log(
    `${dryRun ? "[dry-run] " : ""}Found ${duplicateGroups.length} duplicate group(s).`,
  );

  let removedAddTasks = 0;
  let removedReviewTasks = 0;

  for (const group of duplicateGroups) {
    const { userId, month } = group._id;
    const ids = group.docs.map((d) => d._id);
    const fullDocs = await addTasks.find({ _id: { $in: ids } }).toArray();
    const keeper = pickKeeper(fullDocs);
    const removeIds = fullDocs.filter((d) => !d._id.equals(keeper._id)).map((d) => d._id);

    console.log(
      `userId=${userId} month=${month}: keep ${keeper._id}, remove ${removeIds.length} duplicate(s)`,
    );

    if (removeIds.length === 0) continue;

    if (!dryRun) {
      const reviewDelete = await reviewTasks.deleteMany({ TaskId: { $in: removeIds } });
      removedReviewTasks += reviewDelete.deletedCount ?? 0;

      const addDelete = await addTasks.deleteMany({ _id: { $in: removeIds } });
      removedAddTasks += addDelete.deletedCount ?? 0;
    } else {
      removedAddTasks += removeIds.length;
      const reviewCount = await reviewTasks.countDocuments({ TaskId: { $in: removeIds } });
      removedReviewTasks += reviewCount;
    }
  }

  console.log(
    `${dryRun ? "[dry-run] Would remove" : "Removed"} ${removedAddTasks} addtasks and ${removedReviewTasks} reviewtasks.`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
