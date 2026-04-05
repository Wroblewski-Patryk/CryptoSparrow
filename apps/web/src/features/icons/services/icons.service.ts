import api from "../../../lib/api";
import { CoinIconLookupItem, CoinIconLookupResponse } from "../types/icon.type";

const normalizeSymbol = (value: string) => value.trim().toUpperCase();

export const lookupCoinIcons = async (symbols: string[]): Promise<Map<string, CoinIconLookupItem>> => {
  const uniqueSymbols = Array.from(
    new Set(symbols.map(normalizeSymbol).filter((value) => value.length > 0))
  );
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
