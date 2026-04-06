import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MarketsFlow from './MarketsFlow';
import { EXCHANGE_OPTIONS } from '@/features/exchanges/exchangeCapabilities';

const listMock = vi.hoisted(() => vi.fn());
const createMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());
const catalogMock = vi.hoisted(() => vi.fn());

vi.mock('../services/markets.service', () => ({
  listMarketUniverses: listMock,
  createMarketUniverse: createMock,
  deleteMarketUniverse: deleteMock,
  fetchMarketCatalog: catalogMock,
}));

describe('MarketsFlow', () => {
  const catalogFixture = {
    source: 'BINANCE_PUBLIC',
    exchange: 'BINANCE',
    marketType: 'FUTURES',
    baseCurrency: 'USDT',
    baseCurrencies: ['EUR', 'USDT'],
    totalAvailable: 3,
    totalForBaseCurrency: 2,
    markets: [
      { symbol: 'BTCUSDT', displaySymbol: 'BTC/USDT', baseAsset: 'BTC', quoteAsset: 'USDT', quoteVolume24h: 1000000, lastPrice: 68000 },
      { symbol: 'ETHUSDT', displaySymbol: 'ETH/USDT', baseAsset: 'ETH', quoteAsset: 'USDT', quoteVolume24h: 900000, lastPrice: 3600 },
    ],
  };

  it('renders empty state when no universes returned', async () => {
    listMock.mockResolvedValue([]);
    catalogMock.mockResolvedValue(catalogFixture);

    render(<MarketsFlow />);

    await waitFor(() => {
      expect(screen.getByText('Brak market universes')).toBeInTheDocument();
    });
  });

  it('creates universe from form fields', async () => {
    listMock.mockResolvedValue([]);
    catalogMock.mockResolvedValue(catalogFixture);
    createMock.mockResolvedValue({
      id: 'u1',
      name: 'Top Futures',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      baseCurrency: 'USDT',
      whitelist: ['BTCUSDT'],
      blacklist: [],
    });

    render(<MarketsFlow />);

    fireEvent.change(screen.getByPlaceholderText('Top Futures'), {
      target: { value: 'Top Futures' },
    });

    await waitFor(() => {
      expect(screen.getByText('Liczba rynkow: 2')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Wybierz wszystkie rynki' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj universe' }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({
        name: 'Top Futures',
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        baseCurrency: 'USDT',
        whitelist: ['BTCUSDT', 'ETHUSDT'],
        blacklist: [],
      });
    });
  });

  it('shows full exchange list and placeholder warning for unsupported exchange', async () => {
    listMock.mockResolvedValue([]);
    catalogMock.mockImplementation(async (params?: { exchange?: string }) => {
      const selectedExchange = params?.exchange ?? 'BINANCE';
      const unsupported = selectedExchange !== 'BINANCE';
      return {
        ...catalogFixture,
        exchange: selectedExchange,
        totalAvailable: unsupported ? 0 : catalogFixture.totalAvailable,
        totalForBaseCurrency: unsupported ? 0 : catalogFixture.totalForBaseCurrency,
        markets: unsupported ? [] : catalogFixture.markets,
      };
    });

    render(<MarketsFlow />);

    const exchangeSelect = (await screen.findByLabelText('Gielda')) as HTMLSelectElement;
    const options = Array.from(exchangeSelect.options).map((option) => option.value);
    expect(options).toEqual([...EXCHANGE_OPTIONS]);

    fireEvent.change(exchangeSelect, { target: { value: 'OKX' } });

    await waitFor(() => {
      expect(
        screen.getByText(/Placeholder exchange selected\. Public catalog for this exchange is not implemented yet\./i)
      ).toBeInTheDocument();
    });
  });
});
