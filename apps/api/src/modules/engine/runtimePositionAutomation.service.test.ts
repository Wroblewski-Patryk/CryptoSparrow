import { describe, expect, it, vi } from 'vitest';
import { RuntimePositionAutomationService } from './runtimePositionAutomation.service';

describe('RuntimePositionAutomationService', () => {
  it('closes position when take-profit is hit', async () => {
    const deps: any = {
      listOpenPositionsBySymbol: vi.fn(async () => [
        {
          id: 'pos-1',
          userId: 'user-1',
          botId: 'bot-1',
          strategyId: null,
          symbol: 'BTCUSDT',
          side: 'LONG' as const,
          entryPrice: 60_000,
          quantity: 0.5,
          leverage: 5,
          stopLoss: 58_000,
          takeProfit: 61_000,
        },
      ]),
      getStrategyConfigById: vi.fn(async () => null),
      updatePositionAfterDca: vi.fn(async () => undefined),
      closeByExitSignal: vi.fn(async () => undefined),
    };

    const service = new RuntimePositionAutomationService(deps);
    await service.handleTickerEvent({
      type: 'ticker',
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      eventTime: 1_000,
      lastPrice: 61_500,
      priceChangePercent24h: 1.6,
    });

    expect(deps.closeByExitSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        botId: 'bot-1',
        symbol: 'BTCUSDT',
      })
    );
    expect(deps.updatePositionAfterDca).not.toHaveBeenCalled();
  });

  it('does not force close position when only DCA fallback config is active', async () => {
    process.env.RUNTIME_DCA_ENABLED = 'true';
    process.env.RUNTIME_DCA_MAX_ADDS = '2';
    process.env.RUNTIME_DCA_STEP_PERCENT = '0.01';
    process.env.RUNTIME_DCA_ADD_SIZE_FRACTION = '0.5';
    process.env.RUNTIME_TRAILING_ENABLED = 'false';

    const deps: any = {
      listOpenPositionsBySymbol: vi.fn(async () => [
        {
          id: 'pos-2',
          userId: 'user-2',
          botId: null,
          strategyId: null,
          symbol: 'ETHUSDT',
          side: 'LONG' as const,
          entryPrice: 3000,
          quantity: 1,
          leverage: 5,
          stopLoss: null,
          takeProfit: null,
        },
      ]),
      getStrategyConfigById: vi.fn(async () => null),
      updatePositionAfterDca: vi.fn(async () => undefined),
      closeByExitSignal: vi.fn(async () => undefined),
    };

    const service = new RuntimePositionAutomationService(deps);
    await service.handleTickerEvent({
      type: 'ticker',
      marketType: 'FUTURES',
      symbol: 'ETHUSDT',
      eventTime: 2_000,
      lastPrice: 2950,
      priceChangePercent24h: -0.5,
    });

    expect(deps.closeByExitSignal).not.toHaveBeenCalled();
  });

  it('uses strategy config for management (without env switches)', async () => {
    process.env.RUNTIME_TRAILING_ENABLED = 'false';
    process.env.RUNTIME_DCA_ENABLED = 'false';
    const deps: any = {
      listOpenPositionsBySymbol: vi.fn(async () => [
        {
          id: 'pos-3',
          userId: 'user-3',
          botId: 'bot-3',
          strategyId: 'strat-3',
          symbol: 'SOLUSDT',
          side: 'LONG' as const,
          entryPrice: 100,
          quantity: 1,
          leverage: 5,
          stopLoss: null,
          takeProfit: null,
        },
      ]),
      getStrategyConfigById: vi.fn(async () => ({
        close: { tp: 2, sl: 3, ttp: [{ arm: 1.2, percent: 0.4 }], tsl: [] },
        additional: { dcaEnabled: true, dcaTimes: 2, dcaLevels: [{ percent: -1, multiplier: 1.5 }] },
      })),
      updatePositionAfterDca: vi.fn(async () => undefined),
      closeByExitSignal: vi.fn(async () => undefined),
    };

    const service = new RuntimePositionAutomationService(deps);
    await service.handleTickerEvent({
      type: 'ticker',
      marketType: 'FUTURES',
      symbol: 'SOLUSDT',
      eventTime: 2_500,
      lastPrice: 98.8,
      priceChangePercent24h: -0.6,
    });

    expect(deps.getStrategyConfigById).toHaveBeenCalledWith('strat-3');
    expect(deps.updatePositionAfterDca).toHaveBeenCalledTimes(1);
  });
});
