type NormalizationInput = string | null | undefined;

const normalizeUpperToken = (value: NormalizationInput) => (value ?? '').trim().toUpperCase();

const dedupeSorted = (values: ReadonlyArray<string>) =>
  [...new Set(values.filter((value) => value.length > 0))].sort((left, right) =>
    left.localeCompare(right)
  );

export const normalizeSymbol = (value: NormalizationInput) => normalizeUpperToken(value);

export const normalizeSymbolStrict = (value: NormalizationInput) =>
  normalizeUpperToken(value).replace(/[^A-Z0-9]/g, '');

export const normalizeBaseCurrency = (
  value: NormalizationInput,
  fallback: string = 'USDT'
) => {
  const normalized = normalizeUpperToken(value);
  if (normalized) return normalized;

  const fallbackNormalized = normalizeUpperToken(fallback);
  return fallbackNormalized || 'USDT';
};

export const normalizeSymbols = (symbols: ReadonlyArray<NormalizationInput>) =>
  dedupeSorted(symbols.map((item) => normalizeSymbol(item)));

export const normalizeBaseCurrencies = (baseCurrencies: ReadonlyArray<NormalizationInput>) =>
  dedupeSorted(baseCurrencies.map((item) => normalizeUpperToken(item)));

export const resolveUniverseSymbols = (
  whitelist: ReadonlyArray<NormalizationInput>,
  blacklist: ReadonlyArray<NormalizationInput>
) => {
  const normalizedWhitelist = normalizeSymbols(whitelist);
  const blacklistSet = new Set(normalizeSymbols(blacklist));
  return normalizedWhitelist.filter((symbol) => !blacklistSet.has(symbol));
};
