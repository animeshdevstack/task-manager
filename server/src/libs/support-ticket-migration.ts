import mongoose from "mongoose";

/**
 * Backfill `tasks[]` on legacy SupportTicket docs that only have top-level
 * subTaskId / subTaskName.
 */
export async function migrateSupportTicketTasksArray(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;

  const col = db.collection("supporttickets");

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
              subTaskName: {
                $ifNull: ["$subTaskName", "Task"],
              },
            },
          ],
        },
      },
    ],
  );

  if (result.modifiedCount > 0) {
    console.info(
      `[support-ticket-migration] Backfilled tasks[] on ${result.modifiedCount} legacy ticket(s)`,
    );
  }
}
