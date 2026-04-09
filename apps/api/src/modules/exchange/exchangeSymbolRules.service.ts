import { Exchange } from '@prisma/client';
import { supportsExchangeCapability } from './exchangeCapabilities';

type TradeMarket = 'FUTURES' | 'SPOT';

type CcxtMarketFilter = Record<string, unknown>;
type CcxtMarketLimits = {
  amount?: {
    min?: number;
  };
  cost?: {
    min?: number;
  };
};
type CcxtMarketPrecision = {
  amount?: number;
};
type CcxtMarket = {
  id?: string;
  symbol?: string;
  active?: boolean;
  limits?: CcxtMarketLimits;
  precision?: CcxtMarketPrecision;
  info?: {
    filters?: CcxtMarketFilter[];
  };
};
type CcxtMarketMap = Record<string, CcxtMarket>;

type CcxtExchangeLikeClient = {
  loadMarkets: () => Promise<CcxtMarketMap>;
  close?: () => Promise<void>;
};

type CcxtModuleLike = {
  binance: new (config: Record<string, unknown>) => CcxtExchangeLikeClient;
  binanceusdm: new (config: Record<string, unknown>) => CcxtExchangeLikeClient;
};

type LoadMarketMapFn = (input: {
  exchange: Exchange;
  marketType: TradeMarket;
}) => Promise<CcxtMarketMap>;

type ExchangeSymbolRulesDeps = {
  nowMs: () => number;
  loadMarketMap: LoadMarketMapFn;
};

export type ExchangeSymbolRules = {
  minQuantity: number | null;
  minNotional: number | null;
  quantityStep: number | null;
};

const parsedCacheTtlMs = Number.parseInt(
  process.env.EXCHANGE_SYMBOL_RULES_CACHE_TTL_MS ?? '600000',
  10
);
const EXCHANGE_SYMBOL_RULES_CACHE_TTL_MS = Math.max(
  60_000,
  Number.isFinite(parsedCacheTtlMs) && parsedCacheTtlMs > 0 ? parsedCacheTtlMs : 600_000
);

const rulesCache = new Map<
  string,
  {
    fetchedAt: number;
    rulesBySymbol: Map<string, ExchangeSymbolRules>;
  }
>();
const inflightLoads = new Map<string, Promise<Map<string, ExchangeSymbolRules>>>();

const normalizeSymbol = (value?: string | null) => (value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const resolveSymbolKey = (market: CcxtMarket) => {
  const id = normalizeSymbol(market.id);
  if (id) return id;
  const ccxtPair = typeof market.symbol === 'string' ? market.symbol.split(':')[0] : '';
  return normalizeSymbol(ccxtPair);
};

const asPositiveNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const pickMaxPositive = (values: Array<number | null>) => {
  const positives = values.filter((value): value is number => typeof value === 'number' && value > 0);
  if (positives.length === 0) return null;
  return Math.max(...positives);
};

const parseFilterRules = (filters: unknown) => {
  if (!Array.isArray(filters)) {
    return {
      minQuantity: null as number | null,
      minNotional: null as number | null,
      quantityStep: null as number | null,
    };
  }

  const minQtyCandidates: Array<number | null> = [];
  const minNotionalCandidates: Array<number | null> = [];
  const quantityStepCandidates: Array<number | null> = [];

  for (const rawFilter of filters) {
    if (!rawFilter || typeof rawFilter !== 'object') continue;
    const filter = rawFilter as Record<string, unknown>;
    const filterType = String(filter.filterType ?? '').toUpperCase();

    if (filterType === 'LOT_SIZE' || filterType === 'MARKET_LOT_SIZE') {
      minQtyCandidates.push(asPositiveNumber(filter.minQty));
      quantityStepCandidates.push(asPositiveNumber(filter.stepSize));
    }

    if (filterType === 'MIN_NOTIONAL' || filterType === 'NOTIONAL') {
      minNotionalCandidates.push(asPositiveNumber(filter.minNotional));
      minNotionalCandidates.push(asPositiveNumber(filter.notional));
    }
  }

  return {
    minQuantity: pickMaxPositive(minQtyCandidates),
    minNotional: pickMaxPositive(minNotionalCandidates),
    quantityStep: pickMaxPositive(quantityStepCandidates),
  };
};

const toSymbolRules = (market: CcxtMarket): ExchangeSymbolRules => {
  const filterRules = parseFilterRules(market.info?.filters);
  const minQuantity = pickMaxPositive([
    asPositiveNumber(market.limits?.amount?.min),
    filterRules.minQuantity,
  ]);
  const minNotional = pickMaxPositive([
    asPositiveNumber(market.limits?.cost?.min),
    filterRules.minNotional,
  ]);
  const quantityStep = pickMaxPositive([filterRules.quantityStep]);

  return {
    minQuantity,
    minNotional,
    quantityStep,
  };
};

const defaultLoadMarketMap: LoadMarketMapFn = async (input) => {
  if (input.exchange !== 'BINANCE') {
    return {};
  }

  const ccxtModule = (await import('ccxt')) as unknown as CcxtModuleLike;
  const ExchangeCtor = input.marketType === 'FUTURES' ? ccxtModule.binanceusdm : ccxtModule.binance;
  const client = new ExchangeCtor({
    enableRateLimit: true,
    options: {
      defaultType: input.marketType === 'FUTURES' ? 'future' : 'spot',
    },
  });

  try {
    return await client.loadMarkets();
  } finally {
    if (typeof client.close === 'function') {
      await client.close().catch(() => undefined);
    }
  }
};

const defaultDeps: ExchangeSymbolRulesDeps = {
  nowMs: () => Date.now(),
  loadMarketMap: defaultLoadMarketMap,
};

const resolveCacheKey = (input: { exchange: Exchange; marketType: TradeMarket }) =>
  `${input.exchange}|${input.marketType}`;

const loadRulesBySymbol = async (
  input: {
    exchange: Exchange;
    marketType: TradeMarket;
  },
  deps: ExchangeSymbolRulesDeps
) => {
  const cacheKey = resolveCacheKey(input);
  const now = deps.nowMs();
  const cached = rulesCache.get(cacheKey);
  if (cached && now - cached.fetchedAt < EXCHANGE_SYMBOL_RULES_CACHE_TTL_MS) {
    return cached.rulesBySymbol;
  }

  const inflight = inflightLoads.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const loadPromise = (async () => {
    try {
      const markets = await deps.loadMarketMap({
        exchange: input.exchange,
        marketType: input.marketType,
      });
      const rulesBySymbol = new Map<string, ExchangeSymbolRules>();
      for (const market of Object.values(markets)) {
        if (market.active === false) continue;
        const symbolKey = resolveSymbolKey(market);
        if (!symbolKey) continue;
        rulesBySymbol.set(symbolKey, toSymbolRules(market));
      }
      rulesCache.set(cacheKey, {
        fetchedAt: deps.nowMs(),
        rulesBySymbol,
      });
      return rulesBySymbol;
    } catch {
      return cached?.rulesBySymbol ?? new Map<string, ExchangeSymbolRules>();
    } finally {
      inflightLoads.delete(cacheKey);
    }
  })();

  inflightLoads.set(cacheKey, loadPromise);
  return loadPromise;
};

export const getExchangeSymbolRules = async (
  input: {
    exchange: Exchange;
    marketType: TradeMarket;
    symbol: string;
  },
  deps: ExchangeSymbolRulesDeps = defaultDeps
): Promise<ExchangeSymbolRules | null> => {
  if (!supportsExchangeCapability(input.exchange, 'LIVE_EXECUTION')) {
    return null;
  }

  const normalizedSymbol = normalizeSymbol(input.symbol);
  if (!normalizedSymbol) return null;

  const rulesBySymbol = await loadRulesBySymbol(
    {
      exchange: input.exchange,
      marketType: input.marketType,
    },
    deps
  );

  return rulesBySymbol.get(normalizedSymbol) ?? null;
};

export const __resetExchangeSymbolRulesCacheForTests = () => {
  rulesCache.clear();
  inflightLoads.clear();
};
