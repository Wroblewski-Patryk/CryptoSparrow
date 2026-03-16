
import { Router } from 'express';
import * as controller from './apiKey.controller';

const apiKeyRouter = Router();

apiKeyRouter.route('/')
  .get(controller.list)
  .post(controller.create);

apiKeyRouter.route('/:id')
  .patch(controller.update) 
  .delete(controller.remove);

export default apiKeyRouter;
