import { Router } from 'express';
import { createRateLimiter } from '../../middleware/rateLimit';
import { cancelOrder, closeOrder, getOrder, listOrders, openOrder } from './orders.controller';

const ordersRouter = Router();
const tradingReadLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });
const tradingWriteLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

ordersRouter.get('/', tradingReadLimiter, listOrders);
ordersRouter.get('/:id', tradingReadLimiter, getOrder);
ordersRouter.post('/open', tradingWriteLimiter, openOrder);
ordersRouter.post('/:id/cancel', tradingWriteLimiter, cancelOrder);
ordersRouter.post('/:id/close', tradingWriteLimiter, closeOrder);

export default ordersRouter;
