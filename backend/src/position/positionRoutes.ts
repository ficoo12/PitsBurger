import { Router } from "express";
import { requireAuth, requireOwner } from "../auth/authMiddleware.js";
import {
  createPosition,
  deletePosition,
  listPositions,
  updatePosition,
} from "./positionControllers.js";

const positionRoutes = Router();

// Every position route needs a signed-in owner.
positionRoutes.use(requireAuth, requireOwner);

positionRoutes.post("/", createPosition);
positionRoutes.get("/", listPositions);
positionRoutes.put("/:id", updatePosition);
positionRoutes.delete("/:id", deletePosition);

export default positionRoutes;
