import { Router } from "express";
import { createRateLimiter } from "../../middleware/rateLimit";
import { getLogs } from "./logs.controller";

const logsRouter = Router();
const logsReadLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });

logsRouter.get("/", logsReadLimiter, getLogs);

export default logsRouter;
