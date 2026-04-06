import { Request, Response } from 'express';
import { sendError } from '../../../utils/apiError';
import { sendValidationError } from '../../../utils/formatZodError';
import { AdminSubscriptionPlanCodeParamsSchema, UpdateAdminSubscriptionPlanSchema } from './subscriptionPlans.types';
import * as service from './subscriptionPlans.service';

export const listSubscriptionPlans = async (_req: Request, res: Response) => {
  const plans = await service.listAdminSubscriptionPlans();
  return res.json({ plans });
};

export const updateSubscriptionPlan = async (req: Request, res: Response) => {
  try {
    const params = AdminSubscriptionPlanCodeParamsSchema.parse(req.params);
    const payload = UpdateAdminSubscriptionPlanSchema.parse(req.body);

    const updated = await service.updateAdminSubscriptionPlan(params.code, payload);
    if (!updated) return sendError(res, 404, 'Not found');

    return res.json(updated);
  } catch (error) {
    return sendValidationError(res, error);
  }
};
