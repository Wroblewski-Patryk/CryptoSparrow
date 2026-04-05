import { Exchange } from '@prisma/client';
import { getMarketCatalog } from '../markets/markets.service';
import {
  normalizeSymbols,
  resolveEffectiveSymbolGroupSymbols,
} from './runtimeSymbolUniverse.service';

const resolveMinQuoteVolumeFilter = (filterRules: unknown) => {
  const parsedRules =
    filterRules && typeof filterRules === 'object'
      ? (filterRules as {
          minQuoteVolumeEnabled?: unknown;
          minQuoteVolume24h?: unknown;
          minVolume24h?: unknown;
        })
      : null;
  const enabled = parsedRules?.minQuoteVolumeEnabled === true;
  const minRaw = Number(parsedRules?.minQuoteVolume24h ?? parsedRules?.minVolume24h ?? 0);
  const min = Number.isFinite(minRaw) && minRaw > 0 ? minRaw : 0;
  return { enabled, min };
};

const resolveCatalogSymbolsForUniverse = async (
  universe: {
    exchange: Exchange;
    marketType: 'FUTURES' | 'SPOT';
    baseCurrency: string;
    filterRules: unknown;
    blacklist: string[];
  },
  cache: Map<string, string[]>
) => {
  const volumeFilter = resolveMinQuoteVolumeFilter(universe.filterRules);
  const cacheKey = [
    universe.exchange,
    universe.marketType,
    universe.baseCurrency.toUpperCase(),
    volumeFilter.enabled ? '1' : '0',
    volumeFilter.min.toString(),
    normalizeSymbols(universe.blacklist).join(','),
  ].join('|');
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const catalog = await getMarketCatalog(
      universe.baseCurrency,
      universe.marketType,
      universe.exchange
    );
    const blacklistSet = new Set(normalizeSymbols(universe.blacklist));
    const symbols = normalizeSymbols(
      catalog.markets
        .filter((market) =>
          volumeFilter.enabled ? (market.quoteVolume24h ?? 0) >= volumeFilter.min : true
        )
        .map((market) => market.symbol)
    ).filter((symbol) => !blacklistSet.has(symbol));
    cache.set(cacheKey, symbols);
    return symbols;
  } catch {
    cache.set(cacheKey, []);
    return [];
  }
};

export const resolveEffectiveSymbolGroupSymbolsWithCatalog = async (
  params: {
    symbols?: string[] | null;
    marketUniverse?: {
      exchange?: Exchange | null;
      marketType?: 'FUTURES' | 'SPOT' | null;
      baseCurrency?: string | null;
      filterRules?: unknown;
      whitelist?: string[] | null;
      blacklist?: string[] | null;
    } | null;
  },
  cache: Map<string, string[]>
) => {
  const directSymbols = resolveEffectiveSymbolGroupSymbols(params);
  if (directSymbols.length > 0) return directSymbols;

  const universe = params.marketUniverse;
  if (!universe?.exchange || !universe.marketType || !universe.baseCurrency) {
    return [];
  }

  return resolveCatalogSymbolsForUniverse(
    {
      exchange: universe.exchange,
      marketType: universe.marketType,
      baseCurrency: universe.baseCurrency,
      filterRules: universe.filterRules,
      blacklist: universe.blacklist ?? [],
    },
    cache
  );
};
