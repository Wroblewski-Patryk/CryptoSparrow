import { Request, Response } from 'express';
import { sendError } from '../../utils/apiError';
import { sendValidationError } from '../../utils/formatZodError';
import * as botsService from './bots.service';
import {
  CreateBotMarketGroupSchema,
  CreateBotSchema,
  ListBotsQuerySchema,
  UpdateBotMarketGroupSchema,
  UpdateBotSchema,
} from './bots.types';

export const listBots = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const query = ListBotsQuerySchema.parse(req.query);
    const bots = await botsService.listBots(userId, query);
    return res.json(bots);
  } catch (error) {
    return sendValidationError(res, error);
  }
};

export const getBot = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const { id } = req.params;
  const bot = await botsService.getBot(userId, id);
  if (!bot) return sendError(res, 404, 'Not found');

  return res.json(bot);
};

export const createBot = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = CreateBotSchema.parse(req.body);
    const created = await botsService.createBot(userId, payload);
    return res.status(201).json(created);
  } catch (error) {
    if (error instanceof Error && error.message === 'LIVE_CONSENT_VERSION_REQUIRED') {
      return sendError(res, 400, 'consentTextVersion is required when liveOptIn is enabled');
    }
    if (error instanceof Error && error.message === 'BOT_STRATEGY_NOT_FOUND') {
      return sendError(res, 400, 'strategyId is invalid for current user');
    }
    return sendValidationError(res, error);
  }
};

export const updateBot = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = UpdateBotSchema.parse(req.body);
    const { id } = req.params;
    const updated = await botsService.updateBot(userId, id, payload);
    if (!updated) return sendError(res, 404, 'Not found');

    return res.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === 'LIVE_CONSENT_VERSION_REQUIRED') {
      return sendError(res, 400, 'consentTextVersion is required when liveOptIn is enabled');
    }
    if (error instanceof Error && error.message === 'BOT_STRATEGY_NOT_FOUND') {
      return sendError(res, 400, 'strategyId is invalid for current user');
    }
    return sendValidationError(res, error);
  }
};

export const deleteBot = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const { id } = req.params;
  const deleted = await botsService.deleteBot(userId, id);
  if (!deleted) return sendError(res, 404, 'Not found');

  return res.status(204).end();
};

export const listBotMarketGroups = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const { id } = req.params;
  const groups = await botsService.listBotMarketGroups(userId, id);
  if (!groups) return sendError(res, 404, 'Not found');

  return res.json(groups);
};

export const getBotMarketGroup = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const { id, groupId } = req.params;
  const group = await botsService.getBotMarketGroup(userId, id, groupId);
  if (!group) return sendError(res, 404, 'Not found');

  return res.json(group);
};

export const createBotMarketGroup = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = CreateBotMarketGroupSchema.parse(req.body);
    const { id } = req.params;
    const created = await botsService.createBotMarketGroup(userId, id, payload);
    return res.status(201).json(created);
  } catch (error) {
    if (error instanceof Error && error.message === 'BOT_NOT_FOUND') {
      return sendError(res, 404, 'Not found');
    }
    if (error instanceof Error && error.message === 'SYMBOL_GROUP_NOT_FOUND') {
      return sendError(res, 400, 'symbolGroupId is invalid for current user');
    }
    if (error instanceof Error && error.message === 'BOT_MARKET_GROUP_MARKET_TYPE_MISMATCH') {
      return sendError(res, 400, 'symbolGroup market type must match bot marketType');
    }
    return sendValidationError(res, error);
  }
};

export const updateBotMarketGroup = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = UpdateBotMarketGroupSchema.parse(req.body);
    const { id, groupId } = req.params;
    const updated = await botsService.updateBotMarketGroup(userId, id, groupId, payload);
    if (!updated) return sendError(res, 404, 'Not found');
    return res.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === 'SYMBOL_GROUP_NOT_FOUND') {
      return sendError(res, 400, 'symbolGroupId is invalid for current user');
    }
    if (error instanceof Error && error.message === 'BOT_MARKET_GROUP_MARKET_TYPE_MISMATCH') {
      return sendError(res, 400, 'symbolGroup market type must match bot marketType');
    }
    return sendValidationError(res, error);
  }
};

export const deleteBotMarketGroup = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const { id, groupId } = req.params;
  const deleted = await botsService.deleteBotMarketGroup(userId, id, groupId);
  if (!deleted) return sendError(res, 404, 'Not found');

  return res.status(204).end();
};
