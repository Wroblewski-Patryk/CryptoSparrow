import { describe, expect, it, vi } from 'vitest';
import { analyzePreTrade, PositionReadStore } from './preTrade.service';

const createStore = (overrides?: Partial<PositionReadStore>): PositionReadStore => ({
  countOpenByUser: vi.fn().mockResolvedValue(0),
  countOpenByBot: vi.fn().mockResolvedValue(0),
  hasOpenPositionOnSymbol: vi.fn().mockResolvedValue(false),
  ...overrides,
});

describe('preTrade analysis', () => {
  it('allows trade when checks pass', async () => {
    const store = createStore();

    const decision = await analyzePreTrade(
      {
        userId: 'u1',
        botId: 'b1',
        symbol: 'BTCUSDT',
        mode: 'PAPER',
        liveOptIn: false,
        maxOpenPositionsPerUser: 3,
        maxOpenPositionsPerBot: 2,
      },
      store
    );

    expect(decision.allowed).toBe(true);
    expect(decision.reasons).toEqual([]);
  });

  it('blocks when live mode is requested without opt-in', async () => {
    const store = createStore();

    const decision = await analyzePreTrade(
      {
        userId: 'u1',
        symbol: 'BTCUSDT',
        mode: 'LIVE',
        liveOptIn: false,
      },
      store
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('live_opt_in_required');
  });

  it('blocks on user and bot position limits', async () => {
    const store = createStore({
      countOpenByUser: vi.fn().mockResolvedValue(5),
      countOpenByBot: vi.fn().mockResolvedValue(2),
    });

    const decision = await analyzePreTrade(
      {
        userId: 'u1',
        botId: 'b1',
        symbol: 'ETHUSDT',
        mode: 'PAPER',
        liveOptIn: false,
        maxOpenPositionsPerUser: 5,
        maxOpenPositionsPerBot: 2,
      },
      store
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('user_open_positions_limit_reached');
    expect(decision.reasons).toContain('bot_open_positions_limit_reached');
  });

  it('blocks when open position exists on the same symbol', async () => {
    const store = createStore({
      hasOpenPositionOnSymbol: vi.fn().mockResolvedValue(true),
    });

    const decision = await analyzePreTrade(
      {
        userId: 'u1',
        symbol: 'SOLUSDT',
        mode: 'PAPER',
        liveOptIn: false,
      },
      store
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('open_position_on_symbol_exists');
  });
});
