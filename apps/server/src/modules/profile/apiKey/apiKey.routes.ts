
import { Router } from 'express';
import * as controller from './apiKey.controller';

const apiKeyRouter = Router();

apiKeyRouter.route('/')
  .get((req, res) => controller.list(req as any, res))
  .post((req, res) => controller.create(req as any, res));

apiKeyRouter.route('/:id')
  .patch((req, res) => controller.update(req as any, res)) 
  .delete((req, res) => controller.remove(req as any, res));

export default apiKeyRouter;
