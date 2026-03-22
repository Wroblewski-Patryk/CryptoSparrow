import { Router } from 'express';
import { createRateLimiter } from '../../middleware/rateLimit';
import {
  createMarketUniverse,
  deleteMarketUniverse,
  getMarketUniverse,
  listMarketCatalog,
  listMarketUniverses,
  updateMarketUniverse,
} from './markets.controller';

const marketsRouter = Router();
const marketReadLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });
const marketWriteLimiter = createRateLimiter({ windowMs: 60_000, max: 40 });

marketsRouter.get('/universes', marketReadLimiter, listMarketUniverses);
marketsRouter.get('/universes/:id', marketReadLimiter, getMarketUniverse);
marketsRouter.get('/catalog', marketReadLimiter, listMarketCatalog);
marketsRouter.post('/universes', marketWriteLimiter, createMarketUniverse);
marketsRouter.put('/universes/:id', marketWriteLimiter, updateMarketUniverse);
marketsRouter.delete('/universes/:id', marketWriteLimiter, deleteMarketUniverse);

export default marketsRouter;
