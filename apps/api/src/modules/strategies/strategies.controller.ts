import { Request, Response } from 'express';
import * as strategyService from './strategies.service';
import { sendError } from '../../utils/apiError';
import { mapErrorToHttpResponse } from '../../lib/httpErrorMapper';
import { STRATEGY_ERROR_CODES } from './strategies.errors';

const handleStrategyError = (
  res: Response,
  error: unknown,
  action?: 'update' | 'delete' | 'import'
) => {
  const mapped = mapErrorToHttpResponse(error);

  if (mapped.code === STRATEGY_ERROR_CODES.usedByActiveBot) {
    if (action === 'delete') {
      return sendError(res, 409, 'strategy is used by active bot and cannot be deleted', mapped.details);
    }
    return sendError(res, 409, 'strategy is used by active bot and cannot be edited', mapped.details);
  }

  if (mapped.code === STRATEGY_ERROR_CODES.linkedRecords) {
    return sendError(res, 409, 'strategy has linked records and cannot be deleted', mapped.details);
  }

  if (mapped.code === STRATEGY_ERROR_CODES.invalidImportPayload) {
    return sendError(res, 400, 'Invalid strategy import payload', mapped.details);
  }

  return sendError(res, mapped.status, mapped.message, mapped.details);
};

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
      return handleStrategyError(res, error, 'update');
    }
};

// DELETE /strategies/:id
export const deleteStrategy = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return sendError(res, 401, 'Unauthorized');
    const { id } = req.params;
    try {
      const deleted = await strategyService.deleteStrategy(id, userId);
      if (!deleted) return sendError(res, 404, 'Not found');
      return res.status(204).end();
    } catch (error) {
      return handleStrategyError(res, error, 'delete');
    }
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
    return handleStrategyError(res, error, 'import');
  }
};
