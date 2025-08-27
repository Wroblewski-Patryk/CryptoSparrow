import { Router, Request } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import apiKeyRouter from 'modules/profile/apiKey/apiKey.routes';
import basicRouter from 'modules/profile/basic/basic.routes';
import strategiesRouter from 'modules/strategies/strategies.routes';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

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

export default router;