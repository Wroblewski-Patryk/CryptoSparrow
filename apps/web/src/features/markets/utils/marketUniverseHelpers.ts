import { normalizeSymbolsUniqueSorted } from "@/lib/symbols";

export const uniqueSortedSymbols = (values: string[]) => normalizeSymbolsUniqueSorted(values);

export const composeMarketUniverseSymbols = (params: {
  catalogSymbols: string[];
  whitelistSymbols: string[];
  blacklistSymbols: string[];
}) => {
  const include = uniqueSortedSymbols([...params.catalogSymbols, ...params.whitelistSymbols]);
  const blacklistSet = new Set(uniqueSortedSymbols(params.blacklistSymbols));
  return include.filter((symbol) => !blacklistSet.has(symbol));
};
