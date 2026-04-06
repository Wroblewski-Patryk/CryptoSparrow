import { randomUUID } from 'crypto';
import { Prisma, SubscriptionPlanCode } from '@prisma/client';
import { prisma } from '../../../prisma/client';
import { ensureSubscriptionCatalog } from '../subscriptions.service';
import { resolveConfiguredPaymentProvider, resolvePaymentGatewayAdapter } from './paymentGateway.registry';

type CreateSubscriptionCheckoutIntentInput = {
  userId: string;
  planCode: SubscriptionPlanCode;
  successUrl: string | null;
  cancelUrl: string | null;
};

export const createSubscriptionCheckoutIntent = async (
  input: CreateSubscriptionCheckoutIntentInput,
) => {
  await ensureSubscriptionCatalog(prisma);

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { code: input.planCode },
    select: {
      id: true,
      code: true,
      displayName: true,
      monthlyPriceMinor: true,
      currency: true,
    },
  });
  if (!plan) throw new Error('SUBSCRIPTION_PLAN_NOT_FOUND');
  if (plan.monthlyPriceMinor <= 0) throw new Error('CHECKOUT_PLAN_NOT_PAYABLE');

  const activeSubscription = await prisma.userSubscription.findFirst({
    where: {
      userId: input.userId,
      status: 'ACTIVE',
    },
    orderBy: {
      startsAt: 'desc',
    },
    select: {
      id: true,
    },
  });

  const provider = resolveConfiguredPaymentProvider();
  const adapter = resolvePaymentGatewayAdapter(provider);
  const idempotencyKey = `subs_checkout:${input.userId}:${plan.code}:${Date.now()}:${randomUUID()}`;

  const providerIntent = await adapter.createCheckoutIntent({
    userId: input.userId,
    userSubscriptionId: activeSubscription?.id ?? null,
    idempotencyKey,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    plan: {
      id: plan.id,
      code: plan.code,
      displayName: plan.displayName,
      amountMinor: plan.monthlyPriceMinor,
      currency: plan.currency,
    },
  });

  const paymentIntent = await prisma.paymentIntent.create({
    data: {
      userId: input.userId,
      subscriptionPlanId: plan.id,
      userSubscriptionId: activeSubscription?.id ?? null,
      provider,
      status: providerIntent.status,
      providerReference: providerIntent.providerReference,
      idempotencyKey,
      amountMinor: plan.monthlyPriceMinor,
      currency: plan.currency,
      metadata: {
        planCode: plan.code,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        provider: providerIntent.metadata ?? {},
      } as Prisma.InputJsonValue,
    },
    include: {
      subscriptionPlan: {
        select: { code: true },
      },
    },
  });

  return {
    id: paymentIntent.id,
    planCode: paymentIntent.subscriptionPlan.code,
    provider: paymentIntent.provider,
    status: paymentIntent.status,
    amountMinor: paymentIntent.amountMinor,
    currency: paymentIntent.currency,
    checkoutUrl: providerIntent.checkoutUrl,
    clientSecret: providerIntent.clientSecret,
    expiresAt: providerIntent.expiresAt ? providerIntent.expiresAt.toISOString() : null,
    createdAt: paymentIntent.createdAt.toISOString(),
  };
};
