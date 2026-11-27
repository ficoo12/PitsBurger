import { Router } from "express";
import { me, logout, login } from "./authControllers.js";
import { requireAuth } from "./authMiddleware.js";
import { loginLimiter } from "./helpers/rateLimits.js";

const authRoutes = Router();

authRoutes.post("/login", loginLimiter, login);
authRoutes.post("/logout", logout);
authRoutes.get("/me", requireAuth, me);

export default authRoutes;
