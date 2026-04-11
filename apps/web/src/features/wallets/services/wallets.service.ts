import api from '@/lib/api';
import {
  CreateWalletInput,
  UpdateWalletInput,
  Wallet,
  WalletBalancePreview,
  WalletBalancePreviewInput,
} from '../types/wallet.type';
import type { ExchangeOption } from '@/features/exchanges/exchangeCapabilities';

export const listWallets = async (params?: {
  mode?: 'PAPER' | 'LIVE';
  marketType?: 'FUTURES' | 'SPOT';
  exchange?: ExchangeOption;
}): Promise<Wallet[]> => {
  const res = await api.get<Wallet[]>('/dashboard/wallets', { params: params ?? undefined });
  return res.data;
};

export const getWallet = async (id: string): Promise<Wallet> => {
  const res = await api.get<Wallet>(`/dashboard/wallets/${id}`);
  return res.data;
};

export const createWallet = async (payload: CreateWalletInput): Promise<Wallet> => {
  const res = await api.post<Wallet>('/dashboard/wallets', payload);
  return res.data;
};

export const updateWallet = async (id: string, payload: UpdateWalletInput): Promise<Wallet> => {
  const res = await api.put<Wallet>(`/dashboard/wallets/${id}`, payload);
  return res.data;
};

export const deleteWallet = async (id: string): Promise<void> => {
  await api.delete(`/dashboard/wallets/${id}`);
};

export const previewWalletBalance = async (payload: WalletBalancePreviewInput): Promise<WalletBalancePreview> => {
  const res = await api.post<WalletBalancePreview>('/dashboard/wallets/preview-balance', payload);
  return res.data;
};
