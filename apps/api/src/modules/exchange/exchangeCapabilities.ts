import { Exchange } from '@prisma/client';
import {
  EXCHANGE_BASE_CURRENCY_FALLBACKS,
  EXCHANGE_CAPABILITY_MATRIX,
  EXCHANGE_MARKET_TYPES_BY_EXCHANGE,
  type ExchangeCapability,
  type ExchangeMarketType,
} from '@cryptosparrow/shared';
import { DomainError } from '../../lib/errors';

export type { ExchangeCapability, ExchangeMarketType };

type ExchangeCapabilityMatrix = Record<ExchangeCapability, boolean>;

export const EXCHANGE_NOT_IMPLEMENTED_CODE = 'EXCHANGE_NOT_IMPLEMENTED' as const;

export const EXCHANGE_CAPABILITIES =
  EXCHANGE_CAPABILITY_MATRIX as Record<Exchange, ExchangeCapabilityMatrix>;
const EXCHANGE_MARKET_TYPES = EXCHANGE_MARKET_TYPES_BY_EXCHANGE as Record<
  Exchange,
  ReadonlyArray<ExchangeMarketType>
>;
const EXCHANGE_BASE_CURRENCY_OPTIONS = EXCHANGE_BASE_CURRENCY_FALLBACKS as Record<
  Exchange,
  Record<ExchangeMarketType, ReadonlyArray<string>>
>;

export const supportsExchangeCapability = (
  exchange: Exchange,
  capability: ExchangeCapability
): boolean => EXCHANGE_CAPABILITIES[exchange][capability];

export const getExchangeMarketTypeOptions = (exchange: Exchange): ExchangeMarketType[] =>
  [...(EXCHANGE_MARKET_TYPES[exchange] ?? ['SPOT'])];

export const getExchangeBaseCurrencyFallbacks = (
  exchange: Exchange,
  marketType: ExchangeMarketType
): string[] => [...(EXCHANGE_BASE_CURRENCY_OPTIONS[exchange]?.[marketType] ?? ['USDT'])];

export class ExchangeNotImplementedError extends DomainError<{
  exchange: Exchange;
  capability: ExchangeCapability;
}> {
  constructor(
    public readonly exchange: Exchange,
    public readonly capability: ExchangeCapability
  ) {
    super(
      EXCHANGE_NOT_IMPLEMENTED_CODE,
      `Exchange ${exchange} does not support ${capability}.`,
      {
        status: 501,
        details: {
          exchange,
          capability,
        },
        name: 'ExchangeNotImplementedError',
      }
    );
    this.name = 'ExchangeNotImplementedError';
  }
}

export const assertExchangeCapability = (
  exchange: Exchange,
  capability: ExchangeCapability
): void => {
  if (!supportsExchangeCapability(exchange, capability)) {
    throw new ExchangeNotImplementedError(exchange, capability);
  }
};
