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
          symbol: 'BTCUSDT',
          side: 'LONG' as const,
          entryPrice: 60_000,
          quantity: 0.5,
          stopLoss: 58_000,
          takeProfit: 61_000,
        },
      ]),
      updatePositionAfterDca: vi.fn(async () => undefined),
      closeByExitSignal: vi.fn(async () => undefined),
    };

    const service = new RuntimePositionAutomationService(deps);
    await service.handleTickerEvent({
      type: 'ticker',
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

  it('updates position state when dca is executed', async () => {
    process.env.RUNTIME_DCA_ENABLED = 'true';
    process.env.RUNTIME_DCA_MAX_ADDS = '2';
    process.env.RUNTIME_DCA_STEP_PERCENT = '0.01';
    process.env.RUNTIME_DCA_ADD_SIZE_FRACTION = '0.5';

    const deps: any = {
      listOpenPositionsBySymbol: vi.fn(async () => [
        {
          id: 'pos-2',
          userId: 'user-2',
          botId: null,
          symbol: 'ETHUSDT',
          side: 'LONG' as const,
          entryPrice: 3000,
          quantity: 1,
          stopLoss: null,
          takeProfit: null,
        },
      ]),
      updatePositionAfterDca: vi.fn(async () => undefined),
      closeByExitSignal: vi.fn(async () => undefined),
    };

    const service = new RuntimePositionAutomationService(deps);
    await service.handleTickerEvent({
      type: 'ticker',
      symbol: 'ETHUSDT',
      eventTime: 2_000,
      lastPrice: 2950,
      priceChangePercent24h: -0.5,
    });

    expect(deps.updatePositionAfterDca).toHaveBeenCalledTimes(1);
    expect(deps.closeByExitSignal).not.toHaveBeenCalled();
  });
});
