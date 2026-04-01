import { describe, expect, it } from 'vitest';
import { evaluatePositionManagement } from './positionManagement.service';
import { processPaperLifecycleTick, type PaperLifecycleState } from './paperLifecycle.service';
import { type PositionManagementState } from './positionManagement.types';
import {
  ReplayCandle,
  buildReplayPositionManagementInput,
  parseStrategyRiskConfig,
  simulateTradesForSymbolReplay,
} from '../backtests/backtestReplayCore';
import {
  lifecycleParityGoldenFixtures,
  type LifecycleCloseReason,
} from './fixtures/lifecycleCloseParity.golden';

const toReplayCandles = (closes: number[]): ReplayCandle[] =>
  closes.map((close, index) => ({
    openTime: 1_700_000_000_000 + index * 60_000,
    closeTime: 1_700_000_030_000 + index * 60_000,
    open: close,
    high: close * 1.005,
    low: close * 0.995,
    close,
    volume: 1000 + index,
  }));

const replayCloseReasonMap: Partial<Record<string, LifecycleCloseReason>> = {
  TP: 'take_profit',
  TTP: 'trailing_take_profit',
  SL: 'stop_loss',
  TRAILING: 'trailing_stop',
};

const runBacktestCloseReasons = (input: {
  symbol: string;
  candles: ReplayCandle[];
  leverage: number;
  strategyConfig: Record<string, unknown>;
}) => {
  const replay = simulateTradesForSymbolReplay({
    symbol: input.symbol,
    candles: input.candles,
    marketType: 'FUTURES',
    leverage: input.leverage,
    marginMode: 'CROSSED',
    strategyConfig: input.strategyConfig,
  });

  const closeReasons = replay.events
    .map((event) => replayCloseReasonMap[event.type])
    .filter((reason): reason is LifecycleCloseReason => Boolean(reason));

  return {
    closeReasons,
    entry: replay.events.find((event) => event.type === 'ENTRY') ?? null,
  };
};

const runPaperCloseReasons = (input: {
  candles: ReplayCandle[];
  leverage: number;
  strategyConfig: Record<string, unknown>;
  entry: {
    candleIndex: number;
    side: 'LONG' | 'SHORT';
    price: number;
    quantity: number;
  };
}) => {
  const riskConfig = parseStrategyRiskConfig(input.strategyConfig);
  let state: PaperLifecycleState = {
    orderState: {},
    pendingEntry: null,
    position: {
      side: input.entry.side,
      averageEntryPrice: input.entry.price,
      quantity: input.entry.quantity,
      currentAdds: 0,
    },
  };

  const closeReasons: LifecycleCloseReason[] = [];
  for (let index = input.entry.candleIndex + 1; index < input.candles.length; index += 1) {
    const candle = input.candles[index];
    if (!state.position) break;
    const management = buildReplayPositionManagementInput({
      side: state.position.side,
      currentPrice: candle.close,
      entryPrice: state.position.averageEntryPrice,
      leverage: input.leverage,
      riskConfig,
    });
    const tick = processPaperLifecycleTick(state, {
      markPrice: candle.close,
      entryOrder: {
        side: state.position.side === 'LONG' ? 'BUY' : 'SELL',
        type: 'MARKET',
        quantity: state.position.quantity,
      },
      management,
    });
    state = tick.nextState;
    if (tick.closedPosition && tick.closeReason) {
      closeReasons.push(tick.closeReason);
    }
  }

  return closeReasons;
};

const runLiveCloseReasons = (input: {
  candles: ReplayCandle[];
  leverage: number;
  strategyConfig: Record<string, unknown>;
  entry: {
    candleIndex: number;
    side: 'LONG' | 'SHORT';
    price: number;
    quantity: number;
  };
}) => {
  const riskConfig = parseStrategyRiskConfig(input.strategyConfig);
  const closeReasons: LifecycleCloseReason[] = [];
  let state: PositionManagementState = {
    averageEntryPrice: input.entry.price,
    quantity: input.entry.quantity,
    currentAdds: 0,
    trailingAnchorPrice: input.entry.price,
    lastDcaPrice: undefined as number | undefined,
  };

  for (let index = input.entry.candleIndex + 1; index < input.candles.length; index += 1) {
    const candle = input.candles[index];
    const management = buildReplayPositionManagementInput({
      side: input.entry.side,
      currentPrice: candle.close,
      entryPrice: state.averageEntryPrice,
      leverage: input.leverage,
      riskConfig,
    });
    const result = evaluatePositionManagement(management, state);
    state = result.nextState;
    if (result.shouldClose && result.closeReason) {
      closeReasons.push(result.closeReason);
      break;
    }
  }

  return closeReasons;
};

describe('lifecycle close parity golden fixtures', () => {
  it('keeps identical close-reason sequences for BACKTEST, PAPER and LIVE', () => {
    for (const fixture of lifecycleParityGoldenFixtures) {
      const candles = toReplayCandles(fixture.candles);
      const backtest = runBacktestCloseReasons({
        symbol: fixture.symbol,
        candles,
        leverage: fixture.leverage,
        strategyConfig: fixture.strategyConfig,
      });

      expect(backtest.entry, `${fixture.id}: missing entry event`).toBeTruthy();
      if (!backtest.entry) continue;

      const entry = {
        candleIndex: backtest.entry.candleIndex,
        side: backtest.entry.side,
        price: backtest.entry.price,
        quantity: 1,
      };

      const paperReasons = runPaperCloseReasons({
        candles,
        leverage: fixture.leverage,
        strategyConfig: fixture.strategyConfig,
        entry,
      });
      const liveReasons = runLiveCloseReasons({
        candles,
        leverage: fixture.leverage,
        strategyConfig: fixture.strategyConfig,
        entry,
      });
      expect(backtest.closeReasons, `${fixture.id}: backtest`).toEqual(fixture.expectedCloseReasons);
      expect(paperReasons, `${fixture.id}: paper`).toEqual(fixture.expectedCloseReasons);
      expect(liveReasons, `${fixture.id}: live`).toEqual(fixture.expectedCloseReasons);
      expect(paperReasons, `${fixture.id}: paper-vs-live`).toEqual(liveReasons);
    }
  });
});
