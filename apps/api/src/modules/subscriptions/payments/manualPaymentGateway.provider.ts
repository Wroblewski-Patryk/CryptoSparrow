import { PaymentGatewayAdapter } from './paymentGateway.types';

export const manualPaymentGatewayProvider: PaymentGatewayAdapter = {
  provider: 'MANUAL',
  async createCheckoutIntent(input) {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    return {
      status: 'REQUIRES_ACTION',
      providerReference: `manual:${input.idempotencyKey}`,
      checkoutUrl: input.successUrl,
      clientSecret: null,
      expiresAt,
      metadata: {
        mode: 'manual',
        note: 'Manual provider is configured as abstraction placeholder.',
      },
    };
  },
};
