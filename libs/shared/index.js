const EXCHANGE_OPTIONS = ['BINANCE', 'BYBIT', 'OKX', 'KRAKEN', 'COINBASE'];
const EXCHANGE_MARKET_TYPES = ['FUTURES', 'SPOT'];
const EXCHANGE_CAPABILITIES = [
  'MARKET_CATALOG',
  'PAPER_PRICING_FEED',
  'LIVE_EXECUTION',
  'API_KEY_PROBE',
];

const EXCHANGE_CAPABILITY_MATRIX = {
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

const EXCHANGE_MARKET_TYPES_BY_EXCHANGE = {
  BINANCE: ['FUTURES', 'SPOT'],
  BYBIT: ['FUTURES', 'SPOT'],
  OKX: ['FUTURES', 'SPOT'],
  KRAKEN: ['SPOT'],
  COINBASE: ['SPOT'],
};

const EXCHANGE_BASE_CURRENCY_FALLBACKS = {
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

const DEFAULT_EXCHANGE = 'BINANCE';
const DEFAULT_MARKET_TYPE = 'FUTURES';
const DEFAULT_BASE_CURRENCY = 'USDT';

const isExchangeOption = (value) =>
  typeof value === 'string' && EXCHANGE_OPTIONS.includes(value);

const isExchangeMarketType = (value) =>
  typeof value === 'string' && EXCHANGE_MARKET_TYPES.includes(value);

const isExchangeCapability = (value) =>
  typeof value === 'string' && EXCHANGE_CAPABILITIES.includes(value);

module.exports = {
  DEFAULT_BASE_CURRENCY,
  DEFAULT_EXCHANGE,
  DEFAULT_MARKET_TYPE,
  EXCHANGE_BASE_CURRENCY_FALLBACKS,
  EXCHANGE_CAPABILITIES,
  EXCHANGE_CAPABILITY_MATRIX,
  EXCHANGE_MARKET_TYPES,
  EXCHANGE_MARKET_TYPES_BY_EXCHANGE,
  EXCHANGE_OPTIONS,
  isExchangeCapability,
  isExchangeMarketType,
  isExchangeOption,
};
