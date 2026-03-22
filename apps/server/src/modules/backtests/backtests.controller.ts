import { Request, Response } from 'express';
import { sendError } from '../../utils/apiError';
import { sendValidationError } from '../../utils/formatZodError';
import {
  CreateBacktestRunSchema,
  ListBacktestRunsQuerySchema,
  ListBacktestTradesQuerySchema,
} from './backtests.types';
import * as backtestsService from './backtests.service';

export const listBacktestRuns = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const query = ListBacktestRunsQuerySchema.parse(req.query);
    const runs = await backtestsService.listRuns(userId, query);
    return res.json(runs);
  } catch (error) {
    return sendValidationError(res, error);
  }
};

export const getBacktestRun = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const { id } = req.params;
  const run = await backtestsService.getRun(userId, id);
  if (!run) return sendError(res, 404, 'Not found');

  return res.json(run);
};

export const createBacktestRun = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = CreateBacktestRunSchema.parse(req.body);
    const created = await backtestsService.createRun(userId, payload);
    if (!created) return sendError(res, 404, 'Strategy or market universe not found');
    return res.status(201).json(created);
  } catch (error) {
    return sendValidationError(res, error);
  }
};

export const listBacktestRunTrades = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const query = ListBacktestTradesQuerySchema.parse(req.query);
    const trades = await backtestsService.listRunTrades(userId, req.params.id, query);
    if (!trades) return sendError(res, 404, 'Not found');
    return res.json(trades);
  } catch (error) {
    return sendValidationError(res, error);
  }
};

export const getBacktestRunReport = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const report = await backtestsService.getRunReport(userId, req.params.id);
  if (typeof report === 'undefined') return sendError(res, 404, 'Not found');
  if (!report) return sendError(res, 404, 'Report not found');

  return res.json(report);
};
