import { Router } from 'express';
import * as controller from './subscription.controller';

const subscriptionRouter = Router();

subscriptionRouter.get('/', controller.getSubscription);
subscriptionRouter.post('/checkout-intents', controller.createCheckoutIntent);

export default subscriptionRouter;
