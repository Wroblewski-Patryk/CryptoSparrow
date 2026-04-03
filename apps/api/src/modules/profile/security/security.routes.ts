import { Router } from 'express';
import * as controller from './security.controller';

const securityRouter = Router();

securityRouter.patch('/password', controller.updatePassword);
securityRouter.delete('/account', controller.deleteAccount);

export default securityRouter;

