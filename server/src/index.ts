import cors from "cors";
import express, { Request, Response } from "express";
import authRouter from "./routes/auth.route";
import configuration from "./config/configuration";
import Connection from "./libs/connection";
import addTasksRouter from "./routes/add-tasks.route";
const app = express();

const PORT = configuration.PORT;

const allowedOrigins = new Set([
  configuration.FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS: origin not allowed: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "Server is running",
  });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/add-tasks", addTasksRouter);

async function start() {
  await Connection();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

start();
