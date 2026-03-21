
import { Router } from 'express';
import * as controller from './apiKey.controller';

const apiKeyRouter = Router();

apiKeyRouter.route('/')
  .get(controller.list)
  .post(controller.create);
apiKeyRouter.post('/test', controller.testConnection);

apiKeyRouter.route('/:id')
  .patch(controller.update) 
  .delete(controller.remove);

apiKeyRouter.post('/:id/rotate', controller.rotate);
apiKeyRouter.post('/:id/revoke', controller.revoke);

export default apiKeyRouter;
