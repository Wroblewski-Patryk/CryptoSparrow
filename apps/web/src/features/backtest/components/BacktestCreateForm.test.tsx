import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import BacktestCreateForm from './BacktestCreateForm';

const listStrategiesMock = vi.hoisted(() => vi.fn());
const listMarketUniversesMock = vi.hoisted(() => vi.fn());

vi.mock('../../strategies/api/strategies.api', () => ({
  listStrategies: listStrategiesMock,
}));

vi.mock('../../markets/services/markets.service', () => ({
  listMarketUniverses: listMarketUniversesMock,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('BacktestCreateForm', () => {
  it('disables submit and shows validation when maxCandles is out of range', async () => {
    listStrategiesMock.mockResolvedValue([
      {
        id: 's1',
        name: 'Trend Pulse',
        interval: '5m',
        leverage: 2,
        config: { additional: { marginMode: 'CROSSED' } },
      },
    ]);
    listMarketUniversesMock.mockResolvedValue([
      {
        id: 'm1',
        name: 'Top 3',
        marketType: 'FUTURES',
        baseCurrency: 'USDT',
        whitelist: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
        blacklist: [],
      },
    ]);

    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<BacktestCreateForm submitting={false} submitLabel='Utworz run' onSubmit={onSubmit} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Trend Pulse')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('1200'), { target: { value: '10' } });
    expect(screen.getByText('Podaj liczbe z zakresu 100 - 10000.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Utworz run' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits valid payload with strategy interval and parsed maxCandles', async () => {
    listStrategiesMock.mockResolvedValue([
      {
        id: 's2',
        name: 'EMA Crossover',
        interval: '15m',
        leverage: 3,
        config: { additional: { marginMode: 'ISOLATED' } },
      },
    ]);
    listMarketUniversesMock.mockResolvedValue([
      {
        id: 'm2',
        name: 'Majors',
        marketType: 'FUTURES',
        baseCurrency: 'USDT',
        whitelist: ['BTCUSDT', 'ETHUSDT'],
        blacklist: ['BTCUSDC'],
      },
    ]);

    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<BacktestCreateForm submitting={false} submitLabel='Utworz run' onSubmit={onSubmit} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('EMA Crossover')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('MVP Backtest Run'), { target: { value: 'Parity check run' } });
    fireEvent.change(screen.getByPlaceholderText('1200'), { target: { value: '800' } });

    fireEvent.click(screen.getByRole('button', { name: 'Utworz run' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Parity check run',
        timeframe: '15m',
        strategyId: 's2',
        marketUniverseId: 'm2',
        seedConfig: { maxCandles: 800, initialBalance: 10000 },
        notes: undefined,
      });
    });
  });
});
