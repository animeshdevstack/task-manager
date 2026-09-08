import { Schema, model } from "mongoose";

const userSchema = new Schema({
    Fname: {
        type: String,
        required: true,
        trim: true,
    },
    Lname: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    phone: {
        type: String,
        required: false,
        unique: true,
        trim: true,
        sparse: true,
    },
    password: {
        type: String,
        required: true,
        trim: true,
    },
    role: {
        type: String,
        required: true,
        enum: ["admin", "support", "user"],
        default: "user",
    },
    isActive: {
        type: Boolean,
        required: true,
        default: true,
    },
    emailVerified: {
        type: Boolean,
        required: true,
        default: false,
    },

}, { timestamps: true });

export const User = model("User", userSchema);
