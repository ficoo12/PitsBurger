import { Router } from "express";
import { requireAuth, requireOwner } from "../auth/authMiddleware.js";
import { requireEmployee } from "../employee/employeeMiddleware.js";
import {
  dismissAvailability,
  getAvailability,
  getSettings,
  submitAvailability,
  updateSettings,
} from "./availabilityControllers.js";

const availabilityRoutes = Router();

// The guards sit on each route, not on the router: owners and employees use
// different routes here, each with their own session cookie.

// The employee app: the availability screen, and saving it for next week.
availabilityRoutes.get("/", requireEmployee, getAvailability);
availabilityRoutes.post("/", requireEmployee, submitAvailability);

// The owner's settings: when employees can submit and how often they can save.
availabilityRoutes.get(
  "/settings",
  requireAuth,
  requireOwner,
  getSettings
);
availabilityRoutes.put(
  "/settings",
  requireAuth,
  requireOwner,
  updateSettings
);

// The owner's schedule: hide one day's hint without giving a shift.
availabilityRoutes.post(
  "/dismiss",
  requireAuth,
  requireOwner,
  dismissAvailability
);

export default availabilityRoutes;
