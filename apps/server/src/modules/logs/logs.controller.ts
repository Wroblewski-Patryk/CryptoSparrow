import { Request, Response } from "express";
import { sendError } from "../../utils/apiError";
import { sendValidationError } from "../../utils/formatZodError";
import { LogsQuerySchema } from "./logs.types";
import { listLogs } from "./logs.service";

export const getLogs = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, "Unauthorized");

  try {
    const query = LogsQuerySchema.parse(req.query);
    const logs = await listLogs(userId, query);
    return res.json(logs);
  } catch (error) {
    return sendValidationError(res, error);
  }
};
