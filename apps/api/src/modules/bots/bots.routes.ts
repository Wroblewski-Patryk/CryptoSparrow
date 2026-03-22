import { Router } from 'express';
import { createRateLimiter } from '../../middleware/rateLimit';
import { createBot, deleteBot, getBot, listBots, updateBot } from './bots.controller';

const botsRouter = Router();
const tradingReadLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });
const tradingWriteLimiter = createRateLimiter({ windowMs: 60_000, max: 40 });

botsRouter.get('/', tradingReadLimiter, listBots);
botsRouter.get('/:id', tradingReadLimiter, getBot);
botsRouter.post('/', tradingWriteLimiter, createBot);
botsRouter.put('/:id', tradingWriteLimiter, updateBot);
botsRouter.delete('/:id', tradingWriteLimiter, deleteBot);

export default botsRouter;
