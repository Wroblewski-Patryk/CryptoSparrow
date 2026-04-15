import { DomainError } from '../../lib/errors';

export const SUBSCRIPTION_ERROR_CODES = {
  subscriptionPlanNotFound: 'SUBSCRIPTION_PLAN_NOT_FOUND',
  checkoutPlanNotPayable: 'CHECKOUT_PLAN_NOT_PAYABLE',
  paymentProviderNotConfigured: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
  paymentProviderNotSupported: 'PAYMENT_PROVIDER_NOT_SUPPORTED',
  paymentProviderStripeNotConfigured: 'PAYMENT_PROVIDER_STRIPE_NOT_CONFIGURED',
  paymentProviderStripePriceNotConfigured: 'PAYMENT_PROVIDER_STRIPE_PRICE_NOT_CONFIGURED',
  freeSubscriptionEntitlementsMissing: 'FREE_SUBSCRIPTION_ENTITLEMENTS_MISSING',
} as const;

type SubscriptionErrorCode =
  (typeof SUBSCRIPTION_ERROR_CODES)[keyof typeof SUBSCRIPTION_ERROR_CODES];

export class SubscriptionDomainError extends DomainError {
  constructor(code: SubscriptionErrorCode, status: number, details?: Record<string, unknown>) {
    super(code, code, {
      status,
      details,
      name: 'SubscriptionDomainError',
    });
  }
}

export const subscriptionErrors = {
  subscriptionPlanNotFound: (planCode?: string | null) =>
    new SubscriptionDomainError(
      SUBSCRIPTION_ERROR_CODES.subscriptionPlanNotFound,
      404,
      planCode ? { planCode } : undefined
    ),
  checkoutPlanNotPayable: () =>
    new SubscriptionDomainError(SUBSCRIPTION_ERROR_CODES.checkoutPlanNotPayable, 400),
  paymentProviderNotConfigured: () =>
    new SubscriptionDomainError(SUBSCRIPTION_ERROR_CODES.paymentProviderNotConfigured, 503),
  paymentProviderNotSupported: () =>
    new SubscriptionDomainError(SUBSCRIPTION_ERROR_CODES.paymentProviderNotSupported, 501),
  paymentProviderStripeNotConfigured: () =>
    new SubscriptionDomainError(SUBSCRIPTION_ERROR_CODES.paymentProviderStripeNotConfigured, 503),
  paymentProviderStripePriceNotConfigured: () =>
    new SubscriptionDomainError(SUBSCRIPTION_ERROR_CODES.paymentProviderStripePriceNotConfigured, 503),
  freeSubscriptionEntitlementsMissing: () =>
    new SubscriptionDomainError(SUBSCRIPTION_ERROR_CODES.freeSubscriptionEntitlementsMissing, 500),
};
