import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";

import authRouter from "./routes/auth";
import visitorsRouter from "./routes/visitors";
import visitorTypesRouter from "./routes/visitorTypes";
import customFieldsRouter from "./routes/customFields";
import camerasRouter from "./routes/cameras";
import queueRouter from "./routes/queue";
import sessionsRouter from "./routes/sessions";
import reportsRouter from "./routes/reports";
import healthRouter from "./routes/health";
import usersRouter from "./routes/users";
import stagingRouter from "./routes/staging";
import zohoRouter from "./routes/zoho";
import detectionRouter from "./routes/detection";
import integrationsRouter from "./routes/integrations";

const app = express();

app.use(helmet());
// FRONTEND_URL supports a comma-separated list, e.g. "https://vms.vercel.app,http://localhost:3000"
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((o) => o.trim())
  : "*";
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Static file serving for photos
app.use("/storage", express.static(process.env.STORAGE_PATH || "/storage"));

app.use("/api/auth", authRouter);
app.use("/api/visitors", visitorsRouter);
app.use("/api/visitor-types", visitorTypesRouter);
app.use("/api/custom-fields", customFieldsRouter);
app.use("/api/cameras", camerasRouter);
app.use("/api/queue", queueRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/health", healthRouter);
app.use("/api/users", usersRouter);
app.use("/api/staging", stagingRouter);
app.use("/api/zoho", zohoRouter);
app.use("/api/detection", detectionRouter);
app.use("/api/integrations", integrationsRouter);

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
);

export default app;
