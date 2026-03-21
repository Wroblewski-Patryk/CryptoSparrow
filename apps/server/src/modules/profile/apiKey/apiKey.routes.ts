
import { Router } from 'express';
import * as controller from './apiKey.controller';
import { createRateLimiter } from '../../../middleware/rateLimit';

const apiKeyRouter = Router();
const apiKeyTestLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });

apiKeyRouter.route('/')
  .get(controller.list)
  .post(controller.create);
apiKeyRouter.post('/test', apiKeyTestLimiter, controller.testConnection);

apiKeyRouter.route('/:id')
  .patch(controller.update) 
  .delete(controller.remove);

apiKeyRouter.post('/:id/rotate', controller.rotate);
apiKeyRouter.post('/:id/revoke', controller.revoke);

export default apiKeyRouter;
