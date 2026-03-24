import { Router } from 'express';
import { createRateLimiter } from '../../middleware/rateLimit';
import { getCrossModePerformance } from './reports.controller';

const reportsRouter = Router();
const tradingReadLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });

reportsRouter.get('/cross-mode-performance', tradingReadLimiter, getCrossModePerformance);

export default reportsRouter;

