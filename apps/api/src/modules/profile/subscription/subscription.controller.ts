import { Request, Response } from 'express';
import { z } from 'zod';
import { sendError } from '../../../utils/apiError';
import { sendValidationError } from '../../../utils/formatZodError';
import * as subscriptionService from './subscription.service';
import { createSubscriptionCheckoutIntent } from '../../subscriptions/payments/paymentCheckout.service';

type ProfileRequest = Request & { user?: { id: string } };
const createCheckoutIntentSchema = z.object({
  planCode: z.enum(['FREE', 'ADVANCED', 'PROFESSIONAL']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export const getSubscription = async (req: ProfileRequest, res: Response) => {
  if (!req.user?.id) return sendError(res, 401, 'Unauthorized');

  const payload = await subscriptionService.getProfileSubscription(req.user.id);
  return res.json(payload);
};

export const createCheckoutIntent = async (req: ProfileRequest, res: Response) => {
  if (!req.user?.id) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = createCheckoutIntentSchema.parse(req.body);
    const created = await createSubscriptionCheckoutIntent({
      userId: req.user.id,
      planCode: payload.planCode,
      successUrl: payload.successUrl ?? null,
      cancelUrl: payload.cancelUrl ?? null,
    });
    return res.status(201).json(created);
  } catch (error) {
    if (error instanceof Error && error.message === 'CHECKOUT_PLAN_NOT_PAYABLE') {
      return sendError(res, 400, 'selected subscription plan does not require checkout');
    }
    if (error instanceof Error && error.message === 'SUBSCRIPTION_PLAN_NOT_FOUND') {
      return sendError(res, 404, 'subscription plan not found');
    }
    if (error instanceof Error && error.message === 'PAYMENT_PROVIDER_NOT_CONFIGURED') {
      return sendError(res, 503, 'payment provider is not configured');
    }
    if (error instanceof Error && error.message === 'PAYMENT_PROVIDER_NOT_SUPPORTED') {
      return sendError(res, 501, 'configured payment provider is not supported');
    }
    return sendValidationError(res, error);
  }
};
