export type CoinIconSource = "coingecko" | "curated" | "placeholder";

export type CoinIconLookupItem = {
  symbol: string;
  baseAsset: string;
  iconUrl: string;
  source: CoinIconSource;
  placeholder: boolean;
  coinGeckoId: string | null;
  cacheHit: boolean;
  resolvedAt: string;
};

export type CoinIconLookupResponse = {
  items: CoinIconLookupItem[];
  total: number;
};
