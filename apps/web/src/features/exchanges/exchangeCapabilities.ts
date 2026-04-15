import {
  EXCHANGE_CAPABILITIES as SHARED_EXCHANGE_CAPABILITIES,
  EXCHANGE_CAPABILITY_MATRIX,
  EXCHANGE_OPTIONS,
  type ExchangeCapability,
  type ExchangeOption,
} from '@cryptosparrow/shared';

export { EXCHANGE_OPTIONS };
export type { ExchangeCapability, ExchangeOption };

export const EXCHANGE_CAPABILITIES = SHARED_EXCHANGE_CAPABILITIES;

const EXCHANGE_CAPABILITY_BY_EXCHANGE = EXCHANGE_CAPABILITY_MATRIX as Record<
  ExchangeOption,
  Record<ExchangeCapability, boolean>
>;

export const supportsExchangeCapability = (
  exchange: ExchangeOption | string | null | undefined,
  capability: ExchangeCapability
) => {
  if (!exchange) return false;
  const capabilities = EXCHANGE_CAPABILITY_BY_EXCHANGE[exchange as ExchangeOption];
  if (!capabilities) return false;
  return capabilities[capability] ?? false;
};
