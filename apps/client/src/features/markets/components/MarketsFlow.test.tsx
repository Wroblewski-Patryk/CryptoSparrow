import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MarketsFlow from './MarketsFlow';

const listMock = vi.hoisted(() => vi.fn());
const createMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());

vi.mock('../services/markets.service', () => ({
  listMarketUniverses: listMock,
  createMarketUniverse: createMock,
  deleteMarketUniverse: deleteMock,
}));

describe('MarketsFlow', () => {
  it('renders empty state when no universes returned', async () => {
    listMock.mockResolvedValue([]);

    render(<MarketsFlow />);

    await waitFor(() => {
      expect(screen.getByText('Brak market universes')).toBeInTheDocument();
    });
  });

  it('creates universe from form fields', async () => {
    listMock.mockResolvedValue([]);
    createMock.mockResolvedValue({
      id: 'u1',
      name: 'Top Futures',
      baseCurrency: 'USDT',
      whitelist: ['BTCUSDT'],
      blacklist: [],
    });

    render(<MarketsFlow />);

    fireEvent.change(screen.getByPlaceholderText('Top Futures'), {
      target: { value: 'Top Futures' },
    });
    fireEvent.change(screen.getByPlaceholderText('BTCUSDT, ETHUSDT'), {
      target: { value: 'BTCUSDT' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj universe' }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({
        name: 'Top Futures',
        baseCurrency: 'USDT',
        whitelist: ['BTCUSDT'],
        blacklist: [],
      });
    });
  });
});
