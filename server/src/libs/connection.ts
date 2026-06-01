import mongoose from "mongoose";
import configuration from "../config/configuration";
import { AddTask } from "../model/add-task.model";

const Connection = async () => {
    try {
        await mongoose.connect(configuration.mongoUri);
        await AddTask.syncIndexes();
        console.log("Connected to database");
    } catch (error) {
        console.error("Error connecting to database", error);
        process.exit(1);
    }
}

export default Connection;