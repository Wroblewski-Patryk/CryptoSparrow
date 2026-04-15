import { Request, Response } from 'express';
import { z } from 'zod';
import { sendError } from '../../../utils/apiError';
import { mapErrorToHttpResponse } from '../../../lib/httpErrorMapper';
import * as subscriptionService from './subscription.service';
import { createSubscriptionCheckoutIntent } from '../../subscriptions/payments/paymentCheckout.service';
import { SUBSCRIPTION_ERROR_CODES } from '../../subscriptions/subscriptions.errors';

type ProfileRequest = Request & { user?: { id: string } };
const createCheckoutIntentSchema = z.object({
  planCode: z.enum(['FREE', 'ADVANCED', 'PROFESSIONAL']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

const handleSubscriptionError = (res: Response, error: unknown) => {
  const mapped = mapErrorToHttpResponse(error);

  if (mapped.code === SUBSCRIPTION_ERROR_CODES.checkoutPlanNotPayable) {
    return sendError(res, 400, 'selected subscription plan does not require checkout', mapped.details);
  }
  if (mapped.code === SUBSCRIPTION_ERROR_CODES.subscriptionPlanNotFound) {
    return sendError(res, 404, 'subscription plan not found', mapped.details);
  }
  if (mapped.code === SUBSCRIPTION_ERROR_CODES.paymentProviderNotConfigured) {
    return sendError(res, 503, 'payment provider is not configured', mapped.details);
  }
  if (mapped.code === SUBSCRIPTION_ERROR_CODES.paymentProviderNotSupported) {
    return sendError(res, 501, 'configured payment provider is not supported', mapped.details);
  }
  if (mapped.code === SUBSCRIPTION_ERROR_CODES.paymentProviderStripeNotConfigured) {
    return sendError(res, 503, 'stripe provider is not configured', mapped.details);
  }
  if (mapped.code === SUBSCRIPTION_ERROR_CODES.paymentProviderStripePriceNotConfigured) {
    return sendError(res, 503, 'stripe price id is not configured for selected plan', mapped.details);
  }

  return sendError(res, mapped.status, mapped.message, mapped.details);
};

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
    return handleSubscriptionError(res, error);
  }
};
