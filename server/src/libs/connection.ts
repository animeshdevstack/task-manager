import mongoose from "mongoose";
import configuration from "../config/configuration";
import { AddTask } from "../model/add-task.model";
import { ReviewTask } from "../model/review-task.model";
import { migrateReviewTasksForUniqueIndex } from "./review-task-migration";

const Connection = async () => {
    try {
        await mongoose.connect(configuration.mongoUri);
        await AddTask.syncIndexes();
        await migrateReviewTasksForUniqueIndex();
        await ReviewTask.syncIndexes();
        console.log("Connected to database");
    } catch (error) {
        console.error("Error connecting to database", error);
        process.exit(1);
    }
}

export default Connection;