import { Router } from "express";
import { requireAuth, requireOwner } from "../auth/authMiddleware.js";
import {
  createEntry,
  deleteEntry,
  getSchedule,
  updateEntry,
} from "./scheduleControllers.js";

const scheduleRoutes = Router();

// Every schedule route needs a signed-in owner.
scheduleRoutes.use(requireAuth, requireOwner);

// Always one restaurant and week: GET /api/schedules?restaurantId=3&weekStart=2026-10-05
scheduleRoutes.get("/", getSchedule);
// One cell at a time. A week's schedule is created with its first cell.
scheduleRoutes.post("/entries", createEntry);
scheduleRoutes.put("/entries/:id", updateEntry);
scheduleRoutes.delete("/entries/:id", deleteEntry);

export default scheduleRoutes;
