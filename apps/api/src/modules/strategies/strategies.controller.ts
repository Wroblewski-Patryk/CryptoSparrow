import { Request, Response } from 'express';
import * as strategyService from './strategies.service';
import { sendError } from '../../utils/apiError';

// GET /strategies
export const getStrategies = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return sendError(res, 401, 'Unauthorized');
    const strategies = await strategyService.getStrategies(userId);
    res.json(strategies);
};

// GET /strategies/:id
export const getStrategy = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return sendError(res, 401, 'Unauthorized');
    const { id } = req.params;
    const strategy = await strategyService.getStrategyById(id, userId);
    if (!strategy) return sendError(res, 404, 'Not found');
    res.json(strategy);
};

// POST /strategies
export const createStrategy = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return sendError(res, 401, 'Unauthorized');
    const strategy = await strategyService.createStrategy(userId, req.body);
    res.status(201).json(strategy);
};

// PUT /strategies/:id
export const updateStrategy = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return sendError(res, 401, 'Unauthorized');
    const { id } = req.params;
    try {
      const strategy = await strategyService.updateStrategy(id, userId, req.body);
      if (!strategy) return sendError(res, 404, 'Not found');
      return res.json(strategy);
    } catch (error) {
      if (error instanceof Error && error.message === 'STRATEGY_USED_BY_ACTIVE_BOT') {
        return sendError(res, 409, 'strategy is used by active bot and cannot be edited');
      }
      throw error;
    }
};

// DELETE /strategies/:id
export const deleteStrategy = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return sendError(res, 401, 'Unauthorized');
    const { id } = req.params;
    const deleted = await strategyService.deleteStrategy(id, userId);
    if (!deleted) return sendError(res, 404, 'Not found');
    res.status(204).end();
};

// GET /strategies/:id/export
export const exportStrategy = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const { id } = req.params;
  const exported = await strategyService.exportStrategy(id, userId);
  if (!exported) return sendError(res, 404, 'Not found');
  return res.json(exported);
};

// POST /strategies/import
export const importStrategy = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const imported = await strategyService.importStrategy(userId, req.body);
    return res.status(201).json(imported);
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_STRATEGY_IMPORT_PAYLOAD') {
      return sendError(res, 400, 'Invalid strategy import payload');
    }
    throw error;
  }
};
