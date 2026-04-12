import type { ExchangeOption } from '@/features/exchanges/exchangeCapabilities';

export type WalletMode = 'PAPER' | 'LIVE';
export type WalletAllocationMode = 'PERCENT' | 'FIXED';

export type Wallet = {
  id: string;
  name: string;
  mode: WalletMode;
  exchange: ExchangeOption;
  marketType: 'FUTURES' | 'SPOT';
  baseCurrency: string;
  paperInitialBalance: number;
  liveAllocationMode?: WalletAllocationMode | null;
  liveAllocationValue?: number | null;
  apiKeyId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateWalletInput = {
  name: string;
  mode: WalletMode;
  exchange: ExchangeOption;
  marketType: 'FUTURES' | 'SPOT';
  baseCurrency: string;
  paperInitialBalance: number;
  liveAllocationMode?: WalletAllocationMode | null;
  liveAllocationValue?: number | null;
  apiKeyId?: string | null;
};

export type UpdateWalletInput = Partial<CreateWalletInput>;

export type WalletBalancePreviewInput = {
  exchange: ExchangeOption;
  marketType: 'FUTURES' | 'SPOT';
  baseCurrency: string;
  apiKeyId: string;
  liveAllocationMode?: WalletAllocationMode | null;
  liveAllocationValue?: number | null;
};

export type WalletBalancePreview = {
  exchange: ExchangeOption;
  marketType: 'FUTURES' | 'SPOT';
  baseCurrency: string;
  accountBalance: number;
  freeBalance: number | null;
  referenceBalance: number;
  allocationApplied: {
    mode: WalletAllocationMode;
    value: number;
  } | null;
  fetchedAt: string;
  source: 'BINANCE';
};

export type WalletMetadataMarketType = 'FUTURES' | 'SPOT';

export type WalletMetadataMarketTypeEntry = {
  marketType: WalletMetadataMarketType;
  baseCurrency: string;
  baseCurrencies: string[];
  source: 'MARKET_CATALOG' | 'EXCHANGE_CAPABILITIES';
};

export type WalletMetadata = {
  exchange: ExchangeOption;
  marketTypes: WalletMetadataMarketType[];
  marketType: WalletMetadataMarketType;
  baseCurrency: string;
  baseCurrencies: string[];
  source: 'MARKET_CATALOG' | 'EXCHANGE_CAPABILITIES';
  byMarketType: Record<WalletMetadataMarketType, WalletMetadataMarketTypeEntry>;
};
