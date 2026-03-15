export type MarketUniverse = {
  id: string;
  name: string;
  baseCurrency: string;
  whitelist: string[];
  blacklist: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type CreateMarketUniverseInput = {
  name: string;
  baseCurrency: string;
  whitelist: string[];
  blacklist: string[];
};
