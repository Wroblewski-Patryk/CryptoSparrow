import { describe, expect, it, vi } from 'vitest';
import { analyzePreTrade, AuditLogWriter, BotReadStore, PositionReadStore } from './preTrade.service';

type MockPreTradeStore = PositionReadStore & BotReadStore;

const createStore = (overrides?: Partial<MockPreTradeStore>): MockPreTradeStore => ({
  countOpenByUser: vi.fn().mockResolvedValue(0),
  countOpenByBot: vi.fn().mockResolvedValue(0),
  hasOpenPositionOnSymbol: vi.fn().mockResolvedValue(false),
  getBotLiveConfig: vi.fn().mockResolvedValue({
    mode: 'LIVE',
    marketType: 'FUTURES',
    liveOptIn: true,
    consentTextVersion: 'mvp-v1',
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

  it('writes audit entry for blocked decision', async () => {
    const store = createStore({
      hasOpenPositionOnSymbol: vi.fn().mockResolvedValue(true),
    });
    const auditLogWriter: AuditLogWriter = {
      write: vi.fn().mockResolvedValue(undefined),
    };

    const decision = await analyzePreTrade(
      {
        userId: 'u1',
        botId: 'b1',
        symbol: 'BTCUSDT',
        mode: 'LIVE',
      },
      store,
      auditLogWriter
    );

    expect(decision.allowed).toBe(false);
    expect(auditLogWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        botId: 'b1',
        action: 'trade.precheck.blocked',
        level: 'WARN',
        source: 'engine.pre-trade',
        category: 'TRADING_DECISION',
      })
    );
  });

  it('writes audit entry for allowed live decision', async () => {
    const store = createStore();
    const auditLogWriter: AuditLogWriter = {
      write: vi.fn().mockResolvedValue(undefined),
    };

    const decision = await analyzePreTrade(
      {
        userId: 'u1',
        botId: 'b1',
        symbol: 'BTCUSDT',
        mode: 'LIVE',
      },
      store,
      auditLogWriter
    );

    expect(decision.allowed).toBe(true);
    expect(auditLogWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'trade.precheck.allowed',
        level: 'INFO',
      })
    );
  });

  it('does not fail decision when audit writer throws', async () => {
    const store = createStore();
    const auditLogWriter: AuditLogWriter = {
      write: vi.fn().mockRejectedValue(new Error('db unavailable')),
    };

    const decision = await analyzePreTrade(
      {
        userId: 'u1',
        botId: 'b1',
        symbol: 'BTCUSDT',
        mode: 'LIVE',
      },
      store,
      auditLogWriter
    );

    expect(decision.allowed).toBe(true);
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
        marketType: 'FUTURES',
        liveOptIn: false,
        consentTextVersion: null,
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

  it('blocks when live consent version is missing', async () => {
    const store = createStore({
      getBotLiveConfig: vi.fn().mockResolvedValue({
        mode: 'LIVE',
        marketType: 'FUTURES',
        liveOptIn: true,
        consentTextVersion: null,
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
    expect(decision.reasons).toContain('live_consent_version_required');
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

  it('writes bot marketType into pre-trade audit metadata', async () => {
    const store = createStore({
      getBotLiveConfig: vi.fn().mockResolvedValue({
        mode: 'LIVE',
        marketType: 'SPOT',
        liveOptIn: true,
        consentTextVersion: 'mvp-v1',
      }),
    });
    const auditLogWriter: AuditLogWriter = {
      write: vi.fn().mockResolvedValue(undefined),
    };

    await analyzePreTrade(
      {
        userId: 'u1',
        botId: 'b1',
        symbol: 'BTCUSDT',
        mode: 'LIVE',
      },
      store,
      auditLogWriter
    );

    expect(auditLogWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          marketType: 'SPOT',
        }),
      })
    );
  });
});
