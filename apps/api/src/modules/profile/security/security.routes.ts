import { Router } from 'express';
import * as controller from './security.controller';
import { createRateLimiter } from '../../../middleware/rateLimit';

const securityRouter = Router();
const passwordUpdateLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 5, keyScope: 'user' });
const accountDeleteLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 3, keyScope: 'user' });

securityRouter.patch('/password', passwordUpdateLimiter, controller.updatePassword);
securityRouter.delete('/account', accountDeleteLimiter, controller.deleteAccount);

export default securityRouter;
