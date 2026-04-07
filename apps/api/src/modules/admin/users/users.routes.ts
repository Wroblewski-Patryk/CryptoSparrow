import { Router } from 'express';
import * as controller from './users.controller';

const usersRouter = Router();

usersRouter.get('/', controller.listUsers);
usersRouter.patch('/:userId', controller.updateUser);

export default usersRouter;

