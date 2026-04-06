import { Router } from 'express';
import * as controller from './subscription.controller';

const subscriptionRouter = Router();

subscriptionRouter.get('/', controller.getSubscription);

export default subscriptionRouter;

