import { useEffect, useMemo, useState } from "react";
import { lookupCoinIcons } from "../services/icons.service";
import { CoinIconLookupItem } from "../types/icon.type";

const normalizeSymbol = (value: string) => value.trim().toUpperCase();

const toUniqueSymbols = (symbols: string[]) =>
  Array.from(new Set(symbols.map(normalizeSymbol).filter((value) => value.length > 0))).sort();

export const useCoinIconLookup = (symbols: string[]) => {
  const normalizedSymbols = useMemo(() => toUniqueSymbols(symbols), [symbols]);
  const symbolsKey = useMemo(() => normalizedSymbols.join("|"), [normalizedSymbols]);
  const [iconMap, setIconMap] = useState<Record<string, CoinIconLookupItem>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!symbolsKey) {
      setIconMap({});
      setLoading(false);
      setError(null);
      return;
    }
    const lookupSymbols = symbolsKey.split("|");

    setLoading(true);
    setError(null);
    lookupCoinIcons(lookupSymbols)
      .then((map) => {
        if (cancelled) return;
        const next: Record<string, CoinIconLookupItem> = {};
        for (const [key, value] of map.entries()) next[key] = value;
        setIconMap(next);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setIconMap({});
        setError(err instanceof Error ? err.message : "Failed to load coin icons");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbolsKey]);

  return {
    iconMap,
    loading,
    error,
  };
};
