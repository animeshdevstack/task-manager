import mongoose from "mongoose";

/**
 * Backfill `tasks[]` on legacy SupportActionLog docs that only have top-level
 * subTaskId / isCompleted.
 */
export async function migrateSupportActionLogTasksArray(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;

  const col = db.collection("supportactionlogs");

  const result = await col.updateMany(
    {
      subTaskId: { $exists: true, $ne: null },
      $or: [
        { tasks: { $exists: false } },
        { tasks: { $size: 0 } },
        { tasks: null },
      ],
    },
    [
      {
        $set: {
          tasks: [
            {
              subTaskId: "$subTaskId",
              isCompleted: { $ifNull: ["$isCompleted", false] },
            },
          ],
        },
      },
    ],
  );

  if (result.modifiedCount > 0) {
    console.info(
      `[support-action-log-migration] Backfilled tasks[] on ${result.modifiedCount} legacy action log(s)`,
    );
  }
}
