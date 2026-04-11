import { Exchange } from '@prisma/client';
import { resolveCatalogSymbolsForUniverse } from '../markets/marketCatalogSymbolResolver.service';
import {
  resolveEffectiveSymbolGroupSymbols,
} from './runtimeSymbolUniverse.service';

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
