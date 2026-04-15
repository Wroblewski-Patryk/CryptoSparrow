export declare const EXCHANGE_OPTIONS: readonly [
  'BINANCE',
  'BYBIT',
  'OKX',
  'KRAKEN',
  'COINBASE',
];
export type ExchangeOption = (typeof EXCHANGE_OPTIONS)[number];

export declare const EXCHANGE_MARKET_TYPES: readonly ['FUTURES', 'SPOT'];
export type ExchangeMarketType = (typeof EXCHANGE_MARKET_TYPES)[number];

export declare const EXCHANGE_CAPABILITIES: readonly [
  'MARKET_CATALOG',
  'PAPER_PRICING_FEED',
  'LIVE_EXECUTION',
  'API_KEY_PROBE',
];
export type ExchangeCapability = (typeof EXCHANGE_CAPABILITIES)[number];

export type ExchangeCapabilityMatrix = Record<ExchangeCapability, boolean>;

export declare const EXCHANGE_CAPABILITY_MATRIX: Record<
  ExchangeOption,
  ExchangeCapabilityMatrix
>;

export declare const EXCHANGE_MARKET_TYPES_BY_EXCHANGE: Record<
  ExchangeOption,
  readonly ExchangeMarketType[]
>;

export declare const EXCHANGE_BASE_CURRENCY_FALLBACKS: Record<
  ExchangeOption,
  Record<ExchangeMarketType, readonly string[]>
>;

export declare const DEFAULT_EXCHANGE: ExchangeOption;
export declare const DEFAULT_MARKET_TYPE: ExchangeMarketType;
export declare const DEFAULT_BASE_CURRENCY: string;

export declare const isExchangeOption: (value: unknown) => value is ExchangeOption;
export declare const isExchangeMarketType: (
  value: unknown
) => value is ExchangeMarketType;
export declare const isExchangeCapability: (
  value: unknown
) => value is ExchangeCapability;
