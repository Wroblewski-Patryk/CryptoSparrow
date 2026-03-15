import { describe, expect, it, vi } from 'vitest';
import { analyzePreTrade, BotReadStore, PositionReadStore } from './preTrade.service';

type MockPreTradeStore = PositionReadStore & BotReadStore;

const createStore = (overrides?: Partial<MockPreTradeStore>): MockPreTradeStore => ({
  countOpenByUser: vi.fn().mockResolvedValue(0),
  countOpenByBot: vi.fn().mockResolvedValue(0),
  hasOpenPositionOnSymbol: vi.fn().mockResolvedValue(false),
  getBotLiveConfig: vi.fn().mockResolvedValue({
    mode: 'LIVE',
    liveOptIn: true,
  }),
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

  it('blocks when live mode is requested without bot id', async () => {
    const store = createStore();

    const decision = await analyzePreTrade(
      {
        userId: 'u1',
        symbol: 'BTCUSDT',
        mode: 'LIVE',
      },
      store
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('live_bot_required');
  });

  it('blocks when live bot does not exist for user', async () => {
    const store = createStore({
      getBotLiveConfig: vi.fn().mockResolvedValue(null),
    });

    const decision = await analyzePreTrade(
      {
        userId: 'u1',
        botId: 'missing-bot',
        symbol: 'BTCUSDT',
        mode: 'LIVE',
      },
      store
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('live_bot_not_found');
  });

  it('blocks when bot is not explicitly allowed for live mode', async () => {
    const store = createStore({
      getBotLiveConfig: vi.fn().mockResolvedValue({
        mode: 'PAPER',
        liveOptIn: false,
      }),
    });

    const decision = await analyzePreTrade(
      {
        userId: 'u1',
        botId: 'b1',
        symbol: 'BTCUSDT',
        mode: 'LIVE',
      },
      store
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('live_mode_bot_required');
    expect(decision.reasons).toContain('live_opt_in_required');
  });

  it('blocks when global kill switch is enabled for live mode', async () => {
    const store = createStore();

    const decision = await analyzePreTrade(
      {
        userId: 'u1',
        botId: 'b1',
        symbol: 'BTCUSDT',
        mode: 'LIVE',
        globalKillSwitch: true,
      },
      store
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('global_kill_switch_enabled');
  });

  it('blocks when emergency stop is enabled for live mode', async () => {
    const store = createStore();

    const decision = await analyzePreTrade(
      {
        userId: 'u1',
        botId: 'b1',
        symbol: 'BTCUSDT',
        mode: 'LIVE',
        emergencyStop: true,
      },
      store
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('emergency_stop_enabled');
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
