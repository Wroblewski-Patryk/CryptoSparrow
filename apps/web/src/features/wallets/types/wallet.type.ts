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
