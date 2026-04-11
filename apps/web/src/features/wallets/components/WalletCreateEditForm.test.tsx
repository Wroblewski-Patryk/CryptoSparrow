import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import WalletCreateEditForm from './WalletCreateEditForm';

const replaceMock = vi.hoisted(() => vi.fn());
const fetchApiKeysMock = vi.hoisted(() => vi.fn());
const createWalletMock = vi.hoisted(() => vi.fn());
const getWalletMock = vi.hoisted(() => vi.fn());
const updateWalletMock = vi.hoisted(() => vi.fn());
const previewWalletBalanceMock = vi.hoisted(() => vi.fn());
const fetchMarketCatalogMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock('@/i18n/I18nProvider', () => ({
  useI18n: () => ({ locale: 'pl' }),
}));

vi.mock('@/features/profile/services/apiKeys.service', () => ({
  fetchApiKeys: fetchApiKeysMock,
}));

vi.mock('@/features/markets/services/markets.service', () => ({
  fetchMarketCatalog: fetchMarketCatalogMock,
}));

vi.mock('../services/wallets.service', () => ({
  createWallet: createWalletMock,
  getWallet: getWalletMock,
  updateWallet: updateWalletMock,
  previewWalletBalance: previewWalletBalanceMock,
}));

describe('WalletCreateEditForm', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    fetchApiKeysMock.mockReset();
    createWalletMock.mockReset();
    getWalletMock.mockReset();
    updateWalletMock.mockReset();
    previewWalletBalanceMock.mockReset();
    fetchMarketCatalogMock.mockReset();
    fetchMarketCatalogMock.mockResolvedValue({
      baseCurrencies: ['USDT', 'USDC'],
      baseCurrency: 'USDT',
    });
  });

  it('loads live balance preview for selected API key in LIVE mode', async () => {
    fetchApiKeysMock.mockResolvedValue([
      {
        id: 'key-1',
        label: 'Main Binance Key',
        exchange: 'BINANCE',
      },
    ]);
    previewWalletBalanceMock.mockResolvedValue({
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      baseCurrency: 'USDT',
      accountBalance: 100,
      freeBalance: 98.5,
      referenceBalance: 100,
      allocationApplied: null,
      fetchedAt: '2026-04-10T12:00:00.000Z',
      source: 'BINANCE',
    });

    render(<WalletCreateEditForm />);

    await waitFor(() => {
      expect(fetchApiKeysMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'LIVE' }));

    await waitFor(() => {
      expect(previewWalletBalanceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKeyId: 'key-1',
          exchange: 'BINANCE',
        })
      );
    });

    expect(screen.getByText('Saldo konta')).toBeInTheDocument();
    expect(screen.getAllByText('100.00 USDT').length).toBeGreaterThan(0);
  });

  it('shows validation helper and blocks submit when name is missing', async () => {
    fetchApiKeysMock.mockResolvedValue([]);
    createWalletMock.mockResolvedValue({
      id: 'wallet-1',
    });

    const { container } = render(<WalletCreateEditForm />);

    await waitFor(() => {
      expect(fetchApiKeysMock).toHaveBeenCalled();
    });

    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    expect(createWalletMock).not.toHaveBeenCalled();
    expect(screen.getByText('Podaj nazwe portfela.')).toBeInTheDocument();
  });
});
