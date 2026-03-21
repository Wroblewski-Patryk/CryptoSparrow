export type MarketUniverse = {
  id: string;
  name: string;
  marketType: 'FUTURES' | 'SPOT';
  baseCurrency: string;
  whitelist: string[];
  blacklist: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type CreateMarketUniverseInput = {
  name: string;
  marketType: 'FUTURES' | 'SPOT';
  baseCurrency: string;
  whitelist: string[];
  blacklist: string[];
};

export type UpdateMarketUniverseInput = Partial<CreateMarketUniverseInput>;

export type MarketCatalogEntry = {
  symbol: string;
  displaySymbol: string;
  baseAsset: string;
  quoteAsset: string;
  quoteVolume24h: number;
  lastPrice: number | null;
};

export type MarketCatalog = {
  source: string;
  marketType: 'SPOT' | 'FUTURES';
  baseCurrency: string;
  baseCurrencies: string[];
  totalAvailable: number;
  totalForBaseCurrency: number;
  markets: MarketCatalogEntry[];
};
