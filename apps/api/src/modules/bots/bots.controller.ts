import { Request, Response } from 'express';
import { sendError } from '../../utils/apiError';
import { sendValidationError } from '../../utils/formatZodError';
import * as botsService from './bots.service';
import {
  AssistantDryRunSchema,
  AttachMarketGroupStrategySchema,
  CreateBotMarketGroupSchema,
  CreateBotSchema,
  ListBotsQuerySchema,
  ReorderMarketGroupStrategiesSchema,
  UpsertBotAssistantConfigSchema,
  UpsertBotSubagentConfigSchema,
  UpdateMarketGroupStrategySchema,
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

export const getBotRuntimeGraph = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const { id } = req.params;
  const graph = await botsService.getBotRuntimeGraph(userId, id);
  if (!graph) return sendError(res, 404, 'Not found');

  return res.json(graph);
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

export const listMarketGroupStrategies = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const { id, groupId } = req.params;
  const links = await botsService.listMarketGroupStrategyLinks(userId, id, groupId);
  if (!links) return sendError(res, 404, 'Not found');

  return res.json(links);
};

export const attachMarketGroupStrategy = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = AttachMarketGroupStrategySchema.parse(req.body);
    const { id, groupId } = req.params;
    const created = await botsService.attachMarketGroupStrategy(userId, id, groupId, payload);
    return res.status(201).json(created);
  } catch (error) {
    if (error instanceof Error && error.message === 'BOT_MARKET_GROUP_NOT_FOUND') {
      return sendError(res, 404, 'Not found');
    }
    if (error instanceof Error && error.message === 'BOT_STRATEGY_NOT_FOUND') {
      return sendError(res, 400, 'strategyId is invalid for current user');
    }
    if (error instanceof Error && error.message === 'MARKET_GROUP_STRATEGY_ALREADY_ATTACHED') {
      return sendError(res, 409, 'strategy already attached to this market group');
    }
    return sendValidationError(res, error);
  }
};

export const updateMarketGroupStrategy = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = UpdateMarketGroupStrategySchema.parse(req.body);
    const { id, groupId, linkId } = req.params;
    const updated = await botsService.updateMarketGroupStrategy(userId, id, groupId, linkId, payload);
    if (!updated) return sendError(res, 404, 'Not found');
    return res.json(updated);
  } catch (error) {
    return sendValidationError(res, error);
  }
};

export const detachMarketGroupStrategy = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const { id, groupId, linkId } = req.params;
  const deleted = await botsService.detachMarketGroupStrategy(userId, id, groupId, linkId);
  if (!deleted) return sendError(res, 404, 'Not found');

  return res.status(204).end();
};

export const reorderMarketGroupStrategies = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = ReorderMarketGroupStrategiesSchema.parse(req.body);
    const { id, groupId } = req.params;
    const reordered = await botsService.reorderMarketGroupStrategies(userId, id, groupId, payload);
    if (!reordered) return sendError(res, 404, 'Not found');
    return res.json(reordered);
  } catch (error) {
    if (error instanceof Error && error.message === 'MARKET_GROUP_STRATEGY_LINK_NOT_FOUND') {
      return sendError(res, 400, 'all strategy link ids must belong to current bot market group');
    }
    return sendValidationError(res, error);
  }
};

export const getBotAssistantConfig = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const { id } = req.params;
  const result = await botsService.getBotAssistantConfig(userId, id);
  if (!result) return sendError(res, 404, 'Not found');

  return res.json(result);
};

export const upsertBotAssistantConfig = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = UpsertBotAssistantConfigSchema.parse(req.body);
    const { id } = req.params;
    const updated = await botsService.upsertBotAssistantConfig(userId, id, payload);
    if (!updated) return sendError(res, 404, 'Not found');
    return res.json(updated);
  } catch (error) {
    return sendValidationError(res, error);
  }
};

export const upsertBotSubagentConfig = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const slotIndex = Number(req.params.slotIndex);
  if (!Number.isInteger(slotIndex)) return sendError(res, 400, 'slotIndex must be an integer');

  try {
    const payload = UpsertBotSubagentConfigSchema.parse(req.body);
    const { id } = req.params;
    const updated = await botsService.upsertBotSubagentConfig(userId, id, slotIndex, payload);
    if (!updated) return sendError(res, 404, 'Not found');
    return res.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === 'SUBAGENT_SLOT_OUT_OF_RANGE') {
      return sendError(res, 400, 'slotIndex must be between 1 and 4');
    }
    return sendValidationError(res, error);
  }
};

export const deleteBotSubagentConfig = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const slotIndex = Number(req.params.slotIndex);
  if (!Number.isInteger(slotIndex)) return sendError(res, 400, 'slotIndex must be an integer');

  try {
    const { id } = req.params;
    const deleted = await botsService.deleteBotSubagentConfig(userId, id, slotIndex);
    if (!deleted) return sendError(res, 404, 'Not found');
    return res.status(204).end();
  } catch (error) {
    if (error instanceof Error && error.message === 'SUBAGENT_SLOT_OUT_OF_RANGE') {
      return sendError(res, 400, 'slotIndex must be between 1 and 4');
    }
    return sendValidationError(res, error);
  }
};

export const runAssistantDryRun = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = AssistantDryRunSchema.parse(req.body);
    const { id } = req.params;
    const trace = await botsService.runAssistantDryRun(userId, id, payload);
    if (!trace) return sendError(res, 404, 'Not found');
    return res.json(trace);
  } catch (error) {
    return sendValidationError(res, error);
  }
};
