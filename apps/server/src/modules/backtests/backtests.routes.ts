import { Router } from 'express';
import { createRateLimiter } from '../../middleware/rateLimit';
import { createBacktestRun, getBacktestRun, listBacktestRuns } from './backtests.controller';

const backtestsRouter = Router();
const tradingReadLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });
const tradingWriteLimiter = createRateLimiter({ windowMs: 60_000, max: 40 });

backtestsRouter.get('/runs', tradingReadLimiter, listBacktestRuns);
backtestsRouter.get('/runs/:id', tradingReadLimiter, getBacktestRun);
backtestsRouter.post('/runs', tradingWriteLimiter, createBacktestRun);

export default backtestsRouter;
