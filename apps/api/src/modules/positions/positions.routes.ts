import { Router } from 'express';
import { createRateLimiter } from '../../middleware/rateLimit';
import {
  getExternalTakeoverStatus,
  getExchangeSnapshot,
  getLiveReconciliationStatus,
  getPosition,
  listPositions,
  postExternalTakeoverRebind,
  updatePositionManualParams,
  updatePositionManagementMode,
} from './positions.controller';

const positionsRouter = Router();
const tradingReadLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });

positionsRouter.get('/', tradingReadLimiter, listPositions);
positionsRouter.get('/live-status', tradingReadLimiter, getLiveReconciliationStatus);
positionsRouter.get('/exchange-snapshot', tradingReadLimiter, getExchangeSnapshot);
positionsRouter.get('/takeover-status', tradingReadLimiter, getExternalTakeoverStatus);
positionsRouter.post('/takeover-rebind', tradingReadLimiter, postExternalTakeoverRebind);
positionsRouter.patch('/:id/management-mode', tradingReadLimiter, updatePositionManagementMode);
positionsRouter.patch('/:id/manual-update', tradingReadLimiter, updatePositionManualParams);
positionsRouter.get('/:id', tradingReadLimiter, getPosition);

export default positionsRouter;
