
import { Router } from 'express';
import * as controller from './basic.controller';

const basicRouter = Router();

basicRouter.route('/')
  .get(controller.getProfile)
  .patch(controller.updateProfile);

basicRouter.route('/:id')
  .delete(controller.deleteUser);

export default basicRouter;
