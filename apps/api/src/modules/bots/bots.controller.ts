import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { sendError } from '../../utils/apiError';
import { mapErrorToHttpResponse } from '../../lib/httpErrorMapper';
import { ExchangeNotImplementedError } from '../exchange/exchangeCapabilities';
import { SubscriptionBotLimitError } from '../subscriptions/subscriptionEntitlements.service';
import * as botsService from './bots.service';
import { BOT_ERROR_CODES } from './bots.errors';
import {
  AssistantDryRunSchema,
  AttachMarketGroupStrategySchema,
  CloseBotRuntimePositionSchema,
  CreateBotMarketGroupSchema,
  ListBotRuntimePositionsQuerySchema,
  CreateBotSchema,
  ListBotRuntimeSymbolStatsQuerySchema,
  ListBotRuntimeTradesQuerySchema,
  ListBotRuntimeSessionsQuerySchema,
  ListBotsQuerySchema,
  ReorderMarketGroupStrategiesSchema,
  UpsertBotAssistantConfigSchema,
  UpsertBotSubagentConfigSchema,
  UpdateMarketGroupStrategySchema,
  UpdateBotMarketGroupSchema,
  UpdateBotSchema,
} from './bots.types';

const handleBotError = (res: Response, error: unknown) => {
  const mapped = mapErrorToHttpResponse(error);
  return sendError(res, mapped.status, mapped.message, mapped.details);
};

const handleCloseRuntimePositionError = (res: Response, error: unknown) => {
  const mapped = mapErrorToHttpResponse(error);
  if (mapped.code === BOT_ERROR_CODES.positionCloseRiskAckRequired) {
    return sendError(res, 400, 'riskAck must be true to close runtime position', mapped.details);
  }
  return sendError(res, mapped.status, mapped.message, mapped.details);
};

const handleBotCommandValidationError = (res: Response, error: unknown) => {
  const mapped = mapErrorToHttpResponse(error);
  if (mapped.code === BOT_ERROR_CODES.liveConsentVersionRequired) {
    return sendError(res, 400, 'consentTextVersion is required when liveOptIn is enabled', mapped.details);
  }
  if (mapped.code === BOT_ERROR_CODES.botStrategyNotFound) {
    return sendError(res, 400, 'strategyId is invalid for current user', mapped.details);
  }
  if (mapped.code === BOT_ERROR_CODES.symbolGroupNotFound) {
    return sendError(res, 400, 'marketGroupId is invalid for current user', mapped.details);
  }
  if (mapped.code === BOT_ERROR_CODES.walletNotFound) {
    return sendError(res, 400, 'walletId is invalid for current user', mapped.details);
  }
  if (mapped.code === BOT_ERROR_CODES.walletMarketContextMismatch) {
    return sendError(
      res,
      400,
      'wallet exchange/market/baseCurrency must match selected market group context',
      mapped.details
    );
  }
  if (mapped.code === BOT_ERROR_CODES.walletLiveApiKeyRequired) {
    return sendError(res, 400, 'selected LIVE wallet requires linked exchange api key', mapped.details);
  }
  if (mapped.code === BOT_ERROR_CODES.activeBotStrategyMarketGroupDuplicate) {
    return sendError(
      res,
      409,
      'active bot already exists for this wallet + strategy + market group tuple',
      mapped.details
    );
  }
  if (mapped.code === BOT_ERROR_CODES.botNotFound) {
    return sendError(res, 404, 'Not found', mapped.details);
  }

  return sendError(res, mapped.status, mapped.message, mapped.details);
};

const handleBotMarketGroupError = (res: Response, error: unknown) => {
  const mapped = mapErrorToHttpResponse(error);
  if (mapped.code === BOT_ERROR_CODES.botNotFound) {
    return sendError(res, 404, 'Not found', mapped.details);
  }
  if (mapped.code === BOT_ERROR_CODES.symbolGroupNotFound) {
    return sendError(res, 400, 'symbolGroupId is invalid for current user', mapped.details);
  }
  if (mapped.code === BOT_ERROR_CODES.botMarketGroupMarketTypeMismatch) {
    return sendError(res, 400, 'symbolGroup market type must match bot marketType', mapped.details);
  }
  if (mapped.code === BOT_ERROR_CODES.botMarketGroupExchangeMismatch) {
    return sendError(res, 400, 'symbolGroup exchange must match bot exchange', mapped.details);
  }
  if (mapped.code === BOT_ERROR_CODES.walletMarketContextMismatch) {
    return sendError(
      res,
      400,
      'wallet exchange/market/baseCurrency must match selected market group context',
      mapped.details
    );
  }

  return sendError(res, mapped.status, mapped.message, mapped.details);
};

const handleMarketGroupStrategyError = (res: Response, error: unknown) => {
  const mapped = mapErrorToHttpResponse(error);
  if (mapped.code === BOT_ERROR_CODES.botMarketGroupNotFound) {
    return sendError(res, 404, 'Not found', mapped.details);
  }
  if (mapped.code === BOT_ERROR_CODES.botStrategyNotFound) {
    return sendError(res, 400, 'strategyId is invalid for current user', mapped.details);
  }
  if (mapped.code === BOT_ERROR_CODES.marketGroupStrategyAlreadyAttached) {
    return sendError(res, 409, 'strategy already attached to this market group', mapped.details);
  }
  if (mapped.code === BOT_ERROR_CODES.marketGroupStrategyLinkNotFound) {
    return sendError(res, 400, 'all strategy link ids must belong to current bot market group', mapped.details);
  }

  return sendError(res, mapped.status, mapped.message, mapped.details);
};

const handleSubagentConfigError = (res: Response, error: unknown) => {
  const mapped = mapErrorToHttpResponse(error);
  if (mapped.code === BOT_ERROR_CODES.subagentSlotOutOfRange) {
    return sendError(res, 400, 'slotIndex must be between 1 and 4', mapped.details);
  }

  return sendError(res, mapped.status, mapped.message, mapped.details);
};

export const listBots = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const query = ListBotsQuerySchema.parse(req.query);
    const bots = await botsService.listBots(userId, query);
    return res.json(bots);
  } catch (error) {
    return handleBotError(res, error);
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

export const listBotRuntimeSessions = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const query = ListBotRuntimeSessionsQuerySchema.parse(req.query);
    const { id } = req.params;
    const sessions = await botsService.listBotRuntimeSessions(userId, id, query);
    if (!sessions) return sendError(res, 404, 'Not found');
    return res.json(sessions);
  } catch (error) {
    return handleBotError(res, error);
  }
};

export const getBotRuntimeSession = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const { id, sessionId } = req.params;
  const session = await botsService.getBotRuntimeSession(userId, id, sessionId);
  if (!session) return sendError(res, 404, 'Not found');

  return res.json(session);
};

export const listBotRuntimeSessionSymbolStats = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const query = ListBotRuntimeSymbolStatsQuerySchema.parse(req.query);
    const { id, sessionId } = req.params;
    const stats = await botsService.listBotRuntimeSessionSymbolStats(userId, id, sessionId, query);
    if (!stats) return sendError(res, 404, 'Not found');
    return res.json(stats);
  } catch (error) {
    return handleBotError(res, error);
  }
};

export const listBotRuntimeSessionTrades = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const query = ListBotRuntimeTradesQuerySchema.parse(req.query);
    const { id, sessionId } = req.params;
    const trades = await botsService.listBotRuntimeSessionTrades(userId, id, sessionId, query);
    if (!trades) return sendError(res, 404, 'Not found');
    return res.json(trades);
  } catch (error) {
    return handleBotError(res, error);
  }
};

export const listBotRuntimeSessionPositions = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const query = ListBotRuntimePositionsQuerySchema.parse(req.query);
    const { id, sessionId } = req.params;
    const positions = await botsService.listBotRuntimeSessionPositions(userId, id, sessionId, query);
    if (!positions) return sendError(res, 404, 'Not found');
    return res.json(positions);
  } catch (error) {
    return handleBotError(res, error);
  }
};

export const closeBotRuntimeSessionPosition = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = CloseBotRuntimePositionSchema.parse(req.body ?? {});
    const { id, sessionId, positionId } = req.params;
    const result = await botsService.closeBotRuntimeSessionPosition(
      userId,
      id,
      sessionId,
      positionId,
      payload
    );
    if (!result) return sendError(res, 404, 'Not found');
    return res.status(200).json(result);
  } catch (error) {
    return handleCloseRuntimePositionError(res, error);
  }
};

export const createBot = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = CreateBotSchema.parse(req.body);
    const created = await botsService.createBot(userId, payload);
    return res.status(201).json(created);
  } catch (error) {
    if (error instanceof ExchangeNotImplementedError) {
      return sendError(res, error.status, error.message, error.toDetails());
    }
    if (error instanceof SubscriptionBotLimitError) {
      return sendError(res, 409, 'bot limit for active subscription reached', error.details);
    }
    return handleBotCommandValidationError(res, error);
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
    if (error instanceof ExchangeNotImplementedError) {
      return sendError(res, error.status, error.message, error.toDetails());
    }
    if (error instanceof botsService.BotModeSwitchBlockedError) {
      return sendError(
        res,
        409,
        'cannot switch bot from PAPER to LIVE while paper positions are open; close them first',
        { openPaperPositions: error.openPaperPositions }
      );
    }
    return handleBotCommandValidationError(res, error);
  }
};

export const deleteBot = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const { id } = req.params;
    const deleted = await botsService.deleteBot(userId, id);
    if (!deleted) return sendError(res, 404, 'Not found');

    return res.status(204).end();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return sendError(res, 409, 'bot has linked records and cannot be deleted');
    }
    return sendError(res, 500, 'Internal server error');
  }
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
    return handleBotMarketGroupError(res, error);
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
    return handleBotMarketGroupError(res, error);
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
    return handleMarketGroupStrategyError(res, error);
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
    return handleBotError(res, error);
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
    return handleMarketGroupStrategyError(res, error);
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
    return handleBotError(res, error);
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
    return handleSubagentConfigError(res, error);
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
    return handleSubagentConfigError(res, error);
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
    return handleBotError(res, error);
  }
};
