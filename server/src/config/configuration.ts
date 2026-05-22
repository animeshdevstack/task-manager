import dotenv from "dotenv";



dotenv.config();



const PORT = Number(process.env.PORT) || 3000;



const configuration = {

    PORT,

    mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/task-planner",

    JWT_SECRET: process.env.JWT_SECRET || "leanrm@1234567890",

    FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",

    /** Public base URL of this API (used in verification emails). Set in production to your deployed API URL. */

    API_PUBLIC_URL: process.env.API_PUBLIC_URL || `http://localhost:${PORT}`,

    /** SMTP login (e.g. Gmail address) — set in .env */

    EMAIL: process.env.EMAIL ?? "",

    /** SMTP password (e.g. Gmail app password) — set in .env */

    PASSWORD: process.env.PASSWORD ?? "",

    /** Defaults suit Gmail; override for other providers */

    SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",

    SMTP_PORT: Number(process.env.SMTP_PORT) || 465,

    /** Port 465 uses TLS; set SMTP_SECURE=false when using STARTTLS on 587 */

    SMTP_SECURE:

        process.env.SMTP_SECURE === undefined || process.env.SMTP_SECURE === "true",

}



export default configuration;

