import { describe, expect, it } from 'vitest';
import {
  buildReplayPositionManagementInput,
  parseStrategyRiskConfig,
} from '../backtests/backtestReplayCore';
import {
  buildPositionManagementInput,
  type RuntimeFallbackConfig,
} from './runtimePositionAutomation.service';

const fallback: RuntimeFallbackConfig = {
  dcaEnabled: false,
  dcaMaxAdds: 2,
  dcaStepPercent: 0.01,
  dcaAddSizeFraction: 0.25,
  trailingEnabled: false,
  trailingType: 'percent',
  trailingValue: 0.005,
};

describe('runtime/backtest parser parity', () => {
  it('interprets advanced TTP/TSL and DCA config consistently between runtime and replay', () => {
    const strategyConfig = {
      close: {
        mode: 'advanced',
        tp: 12,
        sl: 8,
        ttp: [
          { arm: 1.5, percent: 0.5 },
          { arm: 2.2, percent: 0.8 },
        ],
        tsl: [
          { arm: 0.7, percent: 0.4 },
          { arm: 1.2, percent: 0.6 },
        ],
      },
      additional: {
        dcaEnabled: true,
        dcaMode: 'advanced',
        dcaTimes: 3,
        dcaLevels: [
          { percent: -1, multiplier: 1.25 },
          { percent: -2, multiplier: 1.5 },
          { percent: -3, multiplier: 1.75 },
        ],
      },
    } satisfies Record<string, unknown>;

    const runtimeInput = buildPositionManagementInput(
      {
        side: 'LONG',
        entryPrice: 100,
        leverage: 5,
        stopLoss: null,
        takeProfit: null,
      },
      101,
      strategyConfig,
      fallback
    );
    const replayInput = buildReplayPositionManagementInput({
      side: 'LONG',
      currentPrice: 101,
      entryPrice: 100,
      leverage: 5,
      riskConfig: parseStrategyRiskConfig(strategyConfig),
    });

    expect(runtimeInput.trailingTakeProfitLevels).toEqual(replayInput.trailingTakeProfitLevels);
    expect(runtimeInput.trailingStopLevels).toEqual(replayInput.trailingStopLevels);
    expect(runtimeInput.dca?.levelPercents).toEqual(replayInput.dca?.levelPercents);
    expect(runtimeInput.dca?.addSizeFractions).toEqual(replayInput.dca?.addSizeFractions);
  });

  it('keeps close.mode=basic semantics aligned (no advanced trailing fields)', () => {
    const strategyConfig = {
      close: {
        mode: 'basic',
        tp: 3,
        sl: 2,
        ttp: [{ arm: 1.5, percent: 0.5 }],
        tsl: [{ arm: 1.2, percent: 0.4 }],
      },
      additional: {
        dcaEnabled: false,
        dcaTimes: 0,
      },
    } satisfies Record<string, unknown>;

    const runtimeInput = buildPositionManagementInput(
      {
        side: 'LONG',
        entryPrice: 100,
        leverage: 3,
        stopLoss: null,
        takeProfit: null,
      },
      100.5,
      strategyConfig,
      fallback
    );
    const replayInput = buildReplayPositionManagementInput({
      side: 'LONG',
      currentPrice: 100.5,
      entryPrice: 100,
      leverage: 3,
      riskConfig: parseStrategyRiskConfig(strategyConfig),
    });

    expect(runtimeInput.trailingTakeProfitLevels).toEqual(replayInput.trailingTakeProfitLevels);
    expect(runtimeInput.trailingStopLevels).toEqual(replayInput.trailingStopLevels);
    expect(runtimeInput.trailingTakeProfit).toBeUndefined();
    expect(runtimeInput.trailingStop).toBeUndefined();
  });
});
