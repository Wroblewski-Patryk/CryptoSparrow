import { Router } from 'express';
import * as controller from './subscriptionPlans.controller';

const subscriptionPlansRouter = Router();

subscriptionPlansRouter.get('/', controller.listSubscriptionPlans);
subscriptionPlansRouter.put('/:code', controller.updateSubscriptionPlan);

export default subscriptionPlansRouter;
