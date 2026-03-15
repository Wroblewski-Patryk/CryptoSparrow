import { Router, Request } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import apiKeyRouter from '../modules/profile/apiKey/apiKey.routes';
import basicRouter from '../modules/profile/basic/basic.routes';
import strategiesRouter from '../modules/strategies/strategies.routes';
import marketsRouter from '../modules/markets/markets.routes';
import botsRouter from '../modules/bots/bots.routes';
import ordersRouter from '../modules/orders/orders.routes';
import positionsRouter from '../modules/positions/positions.routes';
import backtestsRouter from '../modules/backtests/backtests.routes';

const router = Router();
router.use(requireAuth);
router.get('/', (req, res) => {
  res.json({ message: 'Witaj w dashboardzie', user: req.user });
});

// Module - Profile
// Basic profile routes
router.use('/profile/basic', basicRouter);
// API Key management routes
router.use('/profile/apiKeys', apiKeyRouter);
// Subscription management routs


// Module - Strategies
router.use('/strategies', strategiesRouter)

// Module - Markets
router.use('/markets', marketsRouter);

// Module - Bots
router.use('/bots', botsRouter);

// Module - Orders and Positions (read)
router.use('/orders', ordersRouter);
router.use('/positions', positionsRouter);

// Module - Backtests
router.use('/backtests', backtestsRouter);

export default router;
