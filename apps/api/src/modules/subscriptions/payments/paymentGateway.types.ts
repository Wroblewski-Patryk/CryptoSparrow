import { PaymentIntentStatus, PaymentProvider, SubscriptionPlanCode } from '@prisma/client';

export type PaymentPlanContext = {
  id: string;
  code: SubscriptionPlanCode;
  displayName: string;
  amountMinor: number;
  currency: string;
};

export type CreateCheckoutIntentInput = {
  userId: string;
  plan: PaymentPlanContext;
  userSubscriptionId: string | null;
  idempotencyKey: string;
  successUrl: string | null;
  cancelUrl: string | null;
};

export type CreateCheckoutIntentResult = {
  status: PaymentIntentStatus;
  providerReference: string | null;
  checkoutUrl: string | null;
  clientSecret: string | null;
  expiresAt: Date | null;
  metadata?: Record<string, unknown>;
};

export interface PaymentGatewayAdapter {
  readonly provider: PaymentProvider;
  createCheckoutIntent(input: CreateCheckoutIntentInput): Promise<CreateCheckoutIntentResult>;
}
