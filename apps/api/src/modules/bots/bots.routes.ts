import { Router } from 'express';
import { createRateLimiter } from '../../middleware/rateLimit';
import {
  createBot,
  createBotMarketGroup,
  attachMarketGroupStrategy,
  deleteBot,
  deleteBotMarketGroup,
  deleteBotSubagentConfig,
  detachMarketGroupStrategy,
  getBot,
  getBotAssistantConfig,
  getBotRuntimeGraph,
  getBotMarketGroup,
  listBotMarketGroups,
  listMarketGroupStrategies,
  listBots,
  reorderMarketGroupStrategies,
  upsertBotAssistantConfig,
  upsertBotSubagentConfig,
  updateBot,
  updateMarketGroupStrategy,
  updateBotMarketGroup,
} from './bots.controller';

const botsRouter = Router();
const tradingReadLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });
const tradingWriteLimiter = createRateLimiter({ windowMs: 60_000, max: 40 });

botsRouter.get('/', tradingReadLimiter, listBots);
botsRouter.get('/:id', tradingReadLimiter, getBot);
botsRouter.get('/:id/runtime-graph', tradingReadLimiter, getBotRuntimeGraph);
botsRouter.post('/', tradingWriteLimiter, createBot);
botsRouter.put('/:id', tradingWriteLimiter, updateBot);
botsRouter.delete('/:id', tradingWriteLimiter, deleteBot);
botsRouter.get('/:id/market-groups', tradingReadLimiter, listBotMarketGroups);
botsRouter.get('/:id/market-groups/:groupId', tradingReadLimiter, getBotMarketGroup);
botsRouter.post('/:id/market-groups', tradingWriteLimiter, createBotMarketGroup);
botsRouter.put('/:id/market-groups/:groupId', tradingWriteLimiter, updateBotMarketGroup);
botsRouter.delete('/:id/market-groups/:groupId', tradingWriteLimiter, deleteBotMarketGroup);
botsRouter.get('/:id/market-groups/:groupId/strategies', tradingReadLimiter, listMarketGroupStrategies);
botsRouter.post('/:id/market-groups/:groupId/strategies', tradingWriteLimiter, attachMarketGroupStrategy);
botsRouter.put('/:id/market-groups/:groupId/strategies/:linkId', tradingWriteLimiter, updateMarketGroupStrategy);
botsRouter.delete('/:id/market-groups/:groupId/strategies/:linkId', tradingWriteLimiter, detachMarketGroupStrategy);
botsRouter.put('/:id/market-groups/:groupId/strategies/reorder', tradingWriteLimiter, reorderMarketGroupStrategies);
botsRouter.get('/:id/assistant-config', tradingReadLimiter, getBotAssistantConfig);
botsRouter.put('/:id/assistant-config', tradingWriteLimiter, upsertBotAssistantConfig);
botsRouter.put('/:id/assistant-config/subagents/:slotIndex', tradingWriteLimiter, upsertBotSubagentConfig);
botsRouter.delete('/:id/assistant-config/subagents/:slotIndex', tradingWriteLimiter, deleteBotSubagentConfig);

export default botsRouter;
