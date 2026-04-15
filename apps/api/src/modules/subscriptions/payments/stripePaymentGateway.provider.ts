import { PaymentIntentStatus, SubscriptionPlanCode } from '@prisma/client';
import { PaymentGatewayAdapter } from './paymentGateway.types';
import { subscriptionErrors } from '../subscriptions.errors';

type StripeCheckoutSession = {
  id: string;
  status: string;
  url: string | null;
  expires_at: number | null;
};

type StripeClient = {
  checkout: {
    sessions: {
      create: (
        params: Record<string, unknown>,
        options: { idempotencyKey: string },
      ) => Promise<StripeCheckoutSession>;
    };
  };
};

const StripeConstructor = require('stripe') as new (
  secretKey: string,
  config: { apiVersion: string },
) => StripeClient;

const STRIPE_API_VERSION = '2026-02-25.clover';
let stripeClient: StripeClient | null = null;

const getStripeClient = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw subscriptionErrors.paymentProviderStripeNotConfigured();
  }
  if (!stripeClient) {
    stripeClient = new StripeConstructor(secretKey, {
      apiVersion: STRIPE_API_VERSION,
    });
  }
  return stripeClient;
};

const resolvePriceIdForPlan = (planCode: SubscriptionPlanCode): string => {
  const envMap: Record<Exclude<SubscriptionPlanCode, 'FREE'>, string | undefined> = {
    ADVANCED: process.env.STRIPE_PRICE_ID_ADVANCED_MONTHLY,
    PROFESSIONAL: process.env.STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY,
  };

  if (planCode === 'FREE') {
    throw subscriptionErrors.checkoutPlanNotPayable();
  }

  const priceId = envMap[planCode]?.trim();
  if (!priceId) {
    throw subscriptionErrors.paymentProviderStripePriceNotConfigured();
  }

  return priceId;
};

const mapStripeSessionStatus = (status: string): PaymentIntentStatus => {
  if (status === 'complete') return 'SUCCEEDED';
  if (status === 'expired') return 'EXPIRED';
  return 'REQUIRES_ACTION';
};

const resolveDefaultAppUrl = () =>
  process.env.APP_URL?.trim() ||
  process.env.CLIENT_URL?.trim() ||
  process.env.SERVER_URL?.trim() ||
  'http://localhost:3002';

export const stripePaymentGatewayProvider: PaymentGatewayAdapter = {
  provider: 'STRIPE',
  async createCheckoutIntent(input) {
    const stripe = getStripeClient();
    const priceId = resolvePriceIdForPlan(input.plan.code);
    const appUrl = resolveDefaultAppUrl();
    const successUrl = input.successUrl ?? `${appUrl}/dashboard/profile#subscription`;
    const cancelUrl = input.cancelUrl ?? `${appUrl}/dashboard/profile#subscription`;

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: input.userId,
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: {
          userId: input.userId,
          planCode: input.plan.code,
          idempotencyKey: input.idempotencyKey,
        },
        subscription_data: {
          metadata: {
            userId: input.userId,
            planCode: input.plan.code,
            userSubscriptionId: input.userSubscriptionId ?? '',
          },
        },
      },
      {
        idempotencyKey: input.idempotencyKey,
      },
    );

    return {
      status: mapStripeSessionStatus(session.status),
      providerReference: session.id,
      checkoutUrl: session.url ?? null,
      clientSecret: null,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
      metadata: {
        sessionStatus: session.status,
        priceId,
      },
    };
  },
};
