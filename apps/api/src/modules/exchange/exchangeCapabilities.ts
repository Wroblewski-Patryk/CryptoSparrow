import { Exchange } from '@prisma/client';

export type ExchangeCapability =
  | 'MARKET_CATALOG'
  | 'PAPER_PRICING_FEED'
  | 'LIVE_EXECUTION'
  | 'API_KEY_PROBE';

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

export const supportsExchangeCapability = (
  exchange: Exchange,
  capability: ExchangeCapability
): boolean => EXCHANGE_CAPABILITIES[exchange][capability];

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

