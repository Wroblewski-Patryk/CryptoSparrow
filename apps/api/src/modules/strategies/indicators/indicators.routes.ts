import { Router } from 'express';
import * as controller from './indicators.controller';
import { createRateLimiter } from '../../../middleware/rateLimit';

const indicatorsRouter = Router();
const marketLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });

indicatorsRouter.route('/')
  .get(marketLimiter, controller.getIndicatorsController);

export default indicatorsRouter;
