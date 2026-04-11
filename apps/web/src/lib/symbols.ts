export const normalizeSymbol = (value: string | null | undefined) => (value ?? "").trim().toUpperCase();

export const normalizeSymbolsUnique = (symbols: string[]) =>
  [...new Set(symbols.map(normalizeSymbol).filter(Boolean))];

export const normalizeSymbolsUniqueSorted = (symbols: string[]) =>
  normalizeSymbolsUnique(symbols).sort((a, b) => a.localeCompare(b));
