import { Exchange } from '@prisma/client';

export type ExchangeCapability =
  | 'MARKET_CATALOG'
  | 'PAPER_PRICING_FEED'
  | 'LIVE_EXECUTION'
  | 'API_KEY_PROBE';
export type ExchangeMarketType = 'FUTURES' | 'SPOT';

type ExchangeCapabilityMatrix = Record<ExchangeCapability, boolean>;

export const EXCHANGE_NOT_IMPLEMENTED_CODE = 'EXCHANGE_NOT_IMPLEMENTED' as const;

export const EXCHANGE_CAPABILITIES: Record<Exchange, ExchangeCapabilityMatrix> = {
  BINANCE: {
    MARKET_CATALOG: true,
    PAPER_PRICING_FEED: true,
    LIVE_EXECUTION: true,
    API_KEY_PROBE: true,
  },
  BYBIT: {
    MARKET_CATALOG: false,
    PAPER_PRICING_FEED: false,
    LIVE_EXECUTION: false,
    API_KEY_PROBE: false,
  },
  OKX: {
    MARKET_CATALOG: false,
    PAPER_PRICING_FEED: false,
    LIVE_EXECUTION: false,
    API_KEY_PROBE: false,
  },
  KRAKEN: {
    MARKET_CATALOG: false,
    PAPER_PRICING_FEED: false,
    LIVE_EXECUTION: false,
    API_KEY_PROBE: false,
  },
  COINBASE: {
    MARKET_CATALOG: false,
    PAPER_PRICING_FEED: false,
    LIVE_EXECUTION: false,
    API_KEY_PROBE: false,
  },
};

const EXCHANGE_MARKET_TYPES: Record<Exchange, ExchangeMarketType[]> = {
  BINANCE: ['FUTURES', 'SPOT'],
  BYBIT: ['FUTURES', 'SPOT'],
  OKX: ['FUTURES', 'SPOT'],
  KRAKEN: ['SPOT'],
  COINBASE: ['SPOT'],
};

const EXCHANGE_BASE_CURRENCY_FALLBACKS: Record<
  Exchange,
  Record<ExchangeMarketType, string[]>
> = {
  BINANCE: {
    FUTURES: ['USDT', 'USDC', 'BUSD'],
    SPOT: ['USDT', 'USDC', 'BUSD', 'BTC', 'ETH', 'EUR'],
  },
  BYBIT: {
    FUTURES: ['USDT', 'USDC'],
    SPOT: ['USDT', 'USDC', 'BTC', 'ETH'],
  },
  OKX: {
    FUTURES: ['USDT', 'USDC'],
    SPOT: ['USDT', 'USDC', 'BTC', 'ETH'],
  },
  KRAKEN: {
    FUTURES: ['USDT'],
    SPOT: ['USD', 'EUR', 'BTC'],
  },
  COINBASE: {
    FUTURES: ['USDT'],
    SPOT: ['USD', 'USDC', 'BTC'],
  },
};

export const supportsExchangeCapability = (
  exchange: Exchange,
  capability: ExchangeCapability
): boolean => EXCHANGE_CAPABILITIES[exchange][capability];

export const getExchangeMarketTypeOptions = (exchange: Exchange): ExchangeMarketType[] =>
  [...(EXCHANGE_MARKET_TYPES[exchange] ?? ['SPOT'])];

export const getExchangeBaseCurrencyFallbacks = (
  exchange: Exchange,
  marketType: ExchangeMarketType
): string[] => [...(EXCHANGE_BASE_CURRENCY_FALLBACKS[exchange]?.[marketType] ?? ['USDT'])];

export class ExchangeNotImplementedError extends Error {
  readonly code = EXCHANGE_NOT_IMPLEMENTED_CODE;
  readonly status = 501;

  constructor(
    public readonly exchange: Exchange,
    public readonly capability: ExchangeCapability
  ) {
    super(`Exchange ${exchange} does not support ${capability}.`);
    this.name = 'ExchangeNotImplementedError';
  }

  toDetails() {
    return {
      code: this.code,
      exchange: this.exchange,
      capability: this.capability,
    };
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
