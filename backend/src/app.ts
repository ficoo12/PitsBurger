import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { DrizzleQueryError } from "drizzle-orm/errors";
// Excerpt: the full API also mounts restaurants, contracts, employees and
// shifts. Only the features included in this repository are mounted here.
import authRoutes from "./auth/authRoutes.js";
import positionRoutes from "./position/positionRoutes.js";
import scheduleRoutes from "./schedule/scheduleRoutes.js";
import availabilityRoutes from "./availability/availabilityRoutes.js";

export const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);
app.set("trust proxy", 1);
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/positions", positionRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/availability", availabilityRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Errors raised by middleware for a bad request (e.g. express.json() on
  // malformed or oversized JSON) carry a 4xx status: the client's mistake,
  // not a server failure.
  const status: unknown = err?.status;
  if (typeof status === "number" && status >= 400 && status < 500) {
    res.status(status).json({
      error: status === 413 ? "Request too large" : "Invalid request",
    });
    return;
  }

  console.error(err instanceof DrizzleQueryError ? err.cause : err);
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

// Vercel runs the app from this default export (vercel.json "entrypoint").
// Tests and index.ts use the named export.
export default app;
