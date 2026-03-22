import { Router } from 'express';
import { createRateLimiter } from '../../middleware/rateLimit';
import {
  createBot,
  createBotMarketGroup,
  deleteBot,
  deleteBotMarketGroup,
  getBot,
  getBotMarketGroup,
  listBotMarketGroups,
  listBots,
  updateBot,
  updateBotMarketGroup,
} from './bots.controller';

const botsRouter = Router();
const tradingReadLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });
const tradingWriteLimiter = createRateLimiter({ windowMs: 60_000, max: 40 });

botsRouter.get('/', tradingReadLimiter, listBots);
botsRouter.get('/:id', tradingReadLimiter, getBot);
botsRouter.post('/', tradingWriteLimiter, createBot);
botsRouter.put('/:id', tradingWriteLimiter, updateBot);
botsRouter.delete('/:id', tradingWriteLimiter, deleteBot);
botsRouter.get('/:id/market-groups', tradingReadLimiter, listBotMarketGroups);
botsRouter.get('/:id/market-groups/:groupId', tradingReadLimiter, getBotMarketGroup);
botsRouter.post('/:id/market-groups', tradingWriteLimiter, createBotMarketGroup);
botsRouter.put('/:id/market-groups/:groupId', tradingWriteLimiter, updateBotMarketGroup);
botsRouter.delete('/:id/market-groups/:groupId', tradingWriteLimiter, deleteBotMarketGroup);

export default botsRouter;
