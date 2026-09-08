import mongoose from "mongoose";
import configuration from "../config/configuration";
import { AddTask } from "../model/add-task.model";
import { ReviewTask } from "../model/review-task.model";
import { SupportTicket } from "../model/support-ticket.model";
import { SupportActionLog } from "../model/support-action-log.model";
import { migrateReviewTasksForUniqueIndex } from "./review-task-migration";
import { migrateSupportTicketTasksArray } from "./support-ticket-migration";
import { migrateSupportActionLogTasksArray } from "./support-action-log-migration";

const Connection = async () => {
    try {
        await mongoose.connect(configuration.mongoUri);
        await AddTask.syncIndexes();
        await migrateReviewTasksForUniqueIndex();
        await ReviewTask.syncIndexes();
        await migrateSupportTicketTasksArray();
        await SupportTicket.syncIndexes();
        await migrateSupportActionLogTasksArray();
        await SupportActionLog.syncIndexes();
        console.log("Connected to database");
    } catch (error) {
        console.error("Error connecting to database", error);
        process.exit(1);
    }
}

export default Connection;