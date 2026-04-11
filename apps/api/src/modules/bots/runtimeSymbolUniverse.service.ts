import {
  normalizeSymbols,
  resolveUniverseSymbols,
} from '../../lib/symbols';

export { normalizeSymbols, resolveUniverseSymbols };

export const resolveEffectiveSymbolGroupSymbols = (params: {
  symbols?: string[] | null;
  marketUniverse?: { whitelist?: string[] | null; blacklist?: string[] | null } | null;
}) => {
  const whitelist = params.marketUniverse?.whitelist;
  const blacklist = params.marketUniverse?.blacklist;
  if (Array.isArray(whitelist) && Array.isArray(blacklist)) {
    const universeSymbols = resolveUniverseSymbols(whitelist, blacklist);
    if (universeSymbols.length > 0) {
      return universeSymbols;
    }
  }
  return normalizeSymbols(params.symbols ?? []);
};
