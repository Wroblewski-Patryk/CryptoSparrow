export const normalizeSymbol = (value: string | null | undefined) => (value ?? '').trim().toUpperCase();

export const normalizeSymbols = (symbols: string[]) =>
  [...new Set(symbols.map((item) => normalizeSymbol(item)).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

export const resolveUniverseSymbols = (whitelist: string[], blacklist: string[]) => {
  const normalizedWhitelist = normalizeSymbols(whitelist);
  const blacklistSet = new Set(normalizeSymbols(blacklist));
  return normalizedWhitelist.filter((symbol) => !blacklistSet.has(symbol));
};
