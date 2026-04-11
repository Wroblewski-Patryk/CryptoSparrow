import api from "../../../lib/api";
import { normalizeSymbol, normalizeSymbolsUnique } from "@/lib/symbols";
import { CoinIconLookupItem, CoinIconLookupResponse } from "../types/icon.type";

export const lookupCoinIcons = async (symbols: string[]): Promise<Map<string, CoinIconLookupItem>> => {
  const uniqueSymbols = normalizeSymbolsUnique(symbols);
  if (uniqueSymbols.length === 0) return new Map();

  const res = await api.get<CoinIconLookupResponse>("/dashboard/icons/lookup", {
    params: {
      symbols: uniqueSymbols.join(","),
    },
  });

  const bySymbol = new Map<string, CoinIconLookupItem>();
  for (const item of res.data.items ?? []) {
    bySymbol.set(normalizeSymbol(item.symbol), item);
  }
  return bySymbol;
};
