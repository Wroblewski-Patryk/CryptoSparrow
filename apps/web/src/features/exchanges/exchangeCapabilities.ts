export const EXCHANGE_OPTIONS = [
  "BINANCE",
  "BYBIT",
  "OKX",
  "KRAKEN",
  "COINBASE",
] as const;

export type ExchangeOption = (typeof EXCHANGE_OPTIONS)[number];

export type ExchangeCapability =
  | "MARKET_CATALOG"
  | "PAPER_PRICING_FEED"
  | "LIVE_EXECUTION"
  | "API_KEY_PROBE";

const EXCHANGE_CAPABILITIES: Record<
  ExchangeOption,
  Record<ExchangeCapability, boolean>
> = {
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
  exchange: ExchangeOption | string | null | undefined,
  capability: ExchangeCapability
) => {
  if (!exchange) return false;
  const capabilities = EXCHANGE_CAPABILITIES[exchange as ExchangeOption];
  if (!capabilities) return false;
  return capabilities[capability] ?? false;
};
