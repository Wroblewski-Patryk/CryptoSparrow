
import { Router } from 'express';
import * as controller from './basic.controller';

const basicRouter = Router();

basicRouter.route('/')
  .get((req, res) => controller.getProfile(req as any, res))
  .patch((req, res) => controller.updateProfile(req as any, res));

basicRouter.route('/:id')
  .delete((req, res) => controller.deleteUser(req as any, res));

export default basicRouter;
