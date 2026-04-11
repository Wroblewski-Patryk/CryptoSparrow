import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MarketUniverseForm from './MarketUniverseForm';

const fetchCatalogMock = vi.hoisted(() => vi.fn());

vi.mock('../services/markets.service', () => ({
  fetchMarketCatalog: fetchCatalogMock,
}));

describe('MarketUniverseForm', () => {
  beforeEach(() => {
    fetchCatalogMock.mockReset();
    window.location.hash = '';
  });

  it('loads saved volume filter value in edit mode and uses it in preview', async () => {
    fetchCatalogMock.mockResolvedValue({
      source: 'BINANCE_PUBLIC',
      marketType: 'FUTURES',
      baseCurrency: 'USDT',
      baseCurrencies: ['USDT'],
      totalAvailable: 2,
      totalForBaseCurrency: 2,
      markets: [
        {
          symbol: 'BTCUSDT',
          displaySymbol: 'BTC/USDT',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          quoteVolume24h: 1000,
          lastPrice: 68000,
        },
        {
          symbol: 'ETHUSDT',
          displaySymbol: 'ETH/USDT',
          baseAsset: 'ETH',
          quoteAsset: 'USDT',
          quoteVolume24h: 100,
          lastPrice: 3600,
        },
      ],
    });

    render(
      <MarketUniverseForm
        mode='edit'
        initial={{
          id: 'u1',
          name: 'Ulubione',
          marketType: 'FUTURES',
          baseCurrency: 'USDT',
          filterRules: { minQuoteVolumeEnabled: true, minQuoteVolume24h: 500 },
          whitelist: [],
          blacklist: [],
        }}
        submitting={false}
        onSubmit={async () => undefined}
      />
    );

    await waitFor(() => {
      expect(fetchCatalogMock).toHaveBeenCalled();
    });

    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('500');

    await waitFor(() => {
      expect(screen.getByText('Liczba rynkow: 1')).toBeInTheDocument();
    });
  });

  it('keeps initial whitelist/blacklist selections visible in edit mode before user changes context', async () => {
    fetchCatalogMock.mockResolvedValue({
      source: 'BINANCE_PUBLIC',
      marketType: 'FUTURES',
      baseCurrency: 'USDT',
      baseCurrencies: ['USDT'],
      totalAvailable: 1,
      totalForBaseCurrency: 1,
      markets: [
        {
          symbol: 'BTCUSDT',
          displaySymbol: 'BTC/USDT',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          quoteVolume24h: 1000,
          lastPrice: 68000,
        },
      ],
    });

    render(
      <MarketUniverseForm
        mode='edit'
        initial={{
          id: 'u-edit-1',
          name: 'Ulubione',
          marketType: 'FUTURES',
          baseCurrency: 'USDT',
          filterRules: { minQuoteVolumeEnabled: false },
          whitelist: ['BTCUSDT'],
          blacklist: ['ETHUSDT'],
        }}
        submitting={false}
        onSubmit={async () => undefined}
      />
    );

    await waitFor(() => {
      expect(fetchCatalogMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getAllByText('Wybrano: 1').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('allows submitting placeholder exchange context without catalog symbols', async () => {
    fetchCatalogMock.mockRejectedValue({
      response: {
        data: {
          error: {
            message: 'Exchange OKX does not support MARKET_CATALOG.',
          },
        },
      },
    });

    const onSubmit = vi.fn().mockResolvedValue(undefined);

    const { container } = render(
      <MarketUniverseForm
        mode='create'
        submitting={false}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Top Futures'), {
      target: { value: 'OKX Placeholder Universe' },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Gielda')).not.toBeDisabled();
    });

    fireEvent.change(screen.getByLabelText('Gielda'), {
      target: { value: 'OKX' },
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          'Placeholder exchange selected. Public catalog for this exchange is not implemented yet. You can still save the universe context.'
        )
      ).toBeInTheDocument();
    });

    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'OKX Placeholder Universe',
          exchange: 'OKX',
        })
      );
    });
  });

  it('shows validation helper when form is submitted without name', async () => {
    fetchCatalogMock.mockResolvedValue({
      source: 'BINANCE_PUBLIC',
      marketType: 'FUTURES',
      baseCurrency: 'USDT',
      baseCurrencies: ['USDT'],
      totalAvailable: 1,
      totalForBaseCurrency: 1,
      markets: [
        {
          symbol: 'BTCUSDT',
          displaySymbol: 'BTC/USDT',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          quoteVolume24h: 1000,
          lastPrice: 68000,
        },
      ],
    });

    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <MarketUniverseForm mode='create' submitting={false} onSubmit={onSubmit} />
    );

    await waitFor(() => {
      expect(fetchCatalogMock).toHaveBeenCalled();
    });

    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Podaj nazwe grupy rynkow.')).toBeInTheDocument();
  });
});
