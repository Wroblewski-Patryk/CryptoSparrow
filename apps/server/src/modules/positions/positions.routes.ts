import { Router } from 'express';
import { createRateLimiter } from '../../middleware/rateLimit';
import { getExchangeSnapshot, getLiveReconciliationStatus, getPosition, listPositions } from './positions.controller';

const positionsRouter = Router();
const tradingReadLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });

positionsRouter.get('/', tradingReadLimiter, listPositions);
positionsRouter.get('/live-status', tradingReadLimiter, getLiveReconciliationStatus);
positionsRouter.get('/exchange-snapshot', tradingReadLimiter, getExchangeSnapshot);
positionsRouter.get('/:id', tradingReadLimiter, getPosition);

export default positionsRouter;
