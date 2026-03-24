import { Request, Response } from 'express';
import { sendError } from '../../utils/apiError';
import * as reportsService from './reports.service';

export const getCrossModePerformance = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const payload = await reportsService.getCrossModePerformance(userId);
  return res.json(payload);
};

