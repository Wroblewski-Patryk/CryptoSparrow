import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    const { container } = render(<BacktestCreateForm submitting={false} onSubmit={onSubmit} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Trend Pulse')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('1200'), { target: { value: '10' } });
    expect(screen.getByText('Podaj liczbe z zakresu 100 - 10000.')).toBeInTheDocument();

    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);
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
    const { container } = render(<BacktestCreateForm submitting={false} onSubmit={onSubmit} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('EMA Crossover')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText('Nazwa runa');
    await waitFor(() => {
      expect(nameInput).toHaveValue('Backtest EMA Crossover | Majors (15m)');
    });

    fireEvent.change(nameInput, { target: { value: 'Parity check run' } });
    fireEvent.change(screen.getByPlaceholderText('1200'), { target: { value: '800' } });

    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

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

  it('renders explicit venue context summary bound to selected market group', async () => {
    listStrategiesMock.mockResolvedValue([
      {
        id: 's3',
        name: 'Venue Strategy',
        interval: '1h',
        leverage: 2,
        config: { additional: { marginMode: 'CROSSED' } },
      },
    ]);
    listMarketUniversesMock.mockResolvedValue([
      {
        id: 'm3',
        name: 'Spot Context',
        exchange: 'OKX',
        marketType: 'SPOT',
        baseCurrency: 'USDC',
        whitelist: ['BTCUSDC'],
        blacklist: [],
      },
    ]);

    render(<BacktestCreateForm submitting={false} onSubmit={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Kontekst venue (powiazany z wybrana grupa rynkow)')).toBeInTheDocument();
    });

    const contextCard = screen.getByText('Kontekst venue (powiazany z wybrana grupa rynkow)').closest('div');
    expect(contextCard).not.toBeNull();
    const scope = within(contextCard as HTMLElement);
    expect(scope.getByText('OKX')).toBeInTheDocument();
    expect(scope.getByText('SPOT')).toBeInTheDocument();
    expect(scope.getByText('USDC')).toBeInTheDocument();
    expect(
      scope.getByText(
        'Kontekst wykonania backtestu jest dziedziczony z wybranej grupy rynkow i nie moze sie rozjechac.'
      )
    ).toBeInTheDocument();
  });
});
