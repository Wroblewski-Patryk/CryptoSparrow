import { PaymentProvider } from '@prisma/client';
import { z } from 'zod';
import { manualPaymentGatewayProvider } from './manualPaymentGateway.provider';
import { PaymentGatewayAdapter } from './paymentGateway.types';

const configuredProviderSchema = z.nativeEnum(PaymentProvider);

const providers = new Map<PaymentProvider, PaymentGatewayAdapter>([
  [manualPaymentGatewayProvider.provider, manualPaymentGatewayProvider],
]);

export const resolveConfiguredPaymentProvider = (): PaymentProvider => {
  const raw = (process.env.SUBSCRIPTION_PAYMENT_PROVIDER ?? 'MANUAL').trim().toUpperCase();
  const parsed = configuredProviderSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED');
  }
  return parsed.data;
};

export const resolvePaymentGatewayAdapter = (provider: PaymentProvider): PaymentGatewayAdapter => {
  const adapter = providers.get(provider);
  if (!adapter) {
    throw new Error('PAYMENT_PROVIDER_NOT_SUPPORTED');
  }
  return adapter;
};
