import { Router } from 'express';
import { createRateLimiter } from '../../middleware/rateLimit';
import {
  createBacktestRun,
  getBacktestRun,
  getBacktestRunReport,
  listBacktestRuns,
  listBacktestRunTrades,
} from './backtests.controller';

const backtestsRouter = Router();
const tradingReadLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });
const tradingWriteLimiter = createRateLimiter({ windowMs: 60_000, max: 40 });

backtestsRouter.get('/runs', tradingReadLimiter, listBacktestRuns);
backtestsRouter.get('/runs/:id', tradingReadLimiter, getBacktestRun);
backtestsRouter.get('/runs/:id/trades', tradingReadLimiter, listBacktestRunTrades);
backtestsRouter.get('/runs/:id/report', tradingReadLimiter, getBacktestRunReport);
backtestsRouter.post('/runs', tradingWriteLimiter, createBacktestRun);

export default backtestsRouter;
