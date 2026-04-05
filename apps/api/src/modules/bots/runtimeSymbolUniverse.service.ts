export const normalizeSymbols = (symbols: string[]) =>
  [...new Set(symbols.map((item) => item.trim().toUpperCase()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

export const resolveUniverseSymbols = (whitelist: string[], blacklist: string[]) => {
  const normalizedWhitelist = normalizeSymbols(whitelist);
  const blacklistSet = new Set(normalizeSymbols(blacklist));
  return normalizedWhitelist.filter((symbol) => !blacklistSet.has(symbol));
};

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
