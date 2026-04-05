import { Router } from 'express';
import { createRateLimiter } from '../../middleware/rateLimit';
import { lookupIcons } from './icons.controller';

const iconsRouter = Router();
const iconLookupLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });

iconsRouter.get('/lookup', iconLookupLimiter, lookupIcons);

export default iconsRouter;

