import type { ExchangeOption } from "@/features/exchanges/exchangeCapabilities";

export type MarketFilterRules = {
  minQuoteVolumeEnabled: boolean;
  minQuoteVolume24h?: number;
};

export type MarketUniverse = {
  id: string;
  name: string;
  exchange?: ExchangeOption;
  marketType: 'FUTURES' | 'SPOT';
  baseCurrency: string;
  filterRules?: MarketFilterRules | null;
  whitelist: string[];
  blacklist: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type CreateMarketUniverseInput = {
  name: string;
  exchange?: ExchangeOption;
  marketType: 'FUTURES' | 'SPOT';
  baseCurrency: string;
  filterRules?: MarketFilterRules;
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
  exchange?: ExchangeOption;
  marketType: 'SPOT' | 'FUTURES';
  baseCurrency: string;
  baseCurrencies: string[];
  totalAvailable: number;
  totalForBaseCurrency: number;
  markets: MarketCatalogEntry[];
};
