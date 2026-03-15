import { Router } from 'express';
import { createRateLimiter } from '../../middleware/rateLimit';
import { getOrder, listOrders } from './orders.controller';

const ordersRouter = Router();
const tradingReadLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });

ordersRouter.get('/', tradingReadLimiter, listOrders);
ordersRouter.get('/:id', tradingReadLimiter, getOrder);

export default ordersRouter;
