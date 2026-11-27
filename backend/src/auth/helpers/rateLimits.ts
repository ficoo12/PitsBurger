import { rateLimit } from "express-rate-limit";

const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_LIMIT_PER_IP = 5;

// Slows down password guessing: each attempt costs a bcrypt compare (~250 ms
// CPU), so unlimited attempts would also tie up the server. Only failed
// attempts count, so owners who log in successfully are never locked out.
// Counts are kept in memory: fine for one server process, but they reset on
// restart and aren't shared between instances (use a Redis store then).
// On Vercel each function instance has its own counts, so the limit is weaker
// there: accepted for the demo, to be replaced by a shared store before real use.
export const loginLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  limit: LOGIN_LIMIT_PER_IP,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
  skip: () => process.env.NODE_ENV === "test",
});
