import { Router } from 'express';
import * as controller from './subscription.controller';
import { createRateLimiter } from '../../../middleware/rateLimit';

const subscriptionRouter = Router();
const checkoutIntentLimiter = createRateLimiter({ windowMs: 60_000, max: 5, keyScope: 'user' });

subscriptionRouter.get('/', controller.getSubscription);
subscriptionRouter.post('/checkout-intents', checkoutIntentLimiter, controller.createCheckoutIntent);

export default subscriptionRouter;
