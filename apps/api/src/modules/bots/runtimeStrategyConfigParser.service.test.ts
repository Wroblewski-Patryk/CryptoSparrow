import { describe, expect, it } from 'vitest';
import {
  hasAdvancedCloseMode,
  resolveDcaPlannedLevelsFromStrategyConfig,
  resolveTrailingStopLevelsFromStrategyConfig,
  resolveTrailingTakeProfitLevelsFromStrategyConfig,
} from './runtimeStrategyConfigParser.service';

describe('runtimeStrategyConfigParser.service', () => {
  it('detects advanced close mode', () => {
    expect(hasAdvancedCloseMode({ close: { mode: 'advanced' } })).toBe(true);
    expect(hasAdvancedCloseMode({ close: { mode: 'basic' } })).toBe(false);
    expect(hasAdvancedCloseMode(null)).toBe(false);
  });

  it('maps and sorts trailing take-profit levels from strategy config', () => {
    const levels = resolveTrailingTakeProfitLevelsFromStrategyConfig({
      close: {
        mode: 'advanced',
        ttp: [
          { percent: 20, arm: 10 },
          { percent: 5, arm: 2.5 },
        ],
      },
    });

    expect(levels).toEqual([
      { armPercent: 0.05, trailPercent: 0.025 },
      { armPercent: 0.2, trailPercent: 0.1 },
    ]);
  });

  it('maps and sorts trailing stop levels from strategy config', () => {
    const levels = resolveTrailingStopLevelsFromStrategyConfig({
      close: {
        mode: 'advanced',
        tsl: [
          { percent: -25, arm: 10 },
          { percent: -10, arm: 5 },
        ],
      },
    });

    expect(levels).toEqual([
      { armPercent: 0.05, trailPercent: 0.1 },
      { armPercent: 0.1, trailPercent: 0.25 },
    ]);
  });

  it('builds planned DCA levels for advanced and basic modes', () => {
    expect(
      resolveDcaPlannedLevelsFromStrategyConfig({
        additional: {
          dcaEnabled: true,
          dcaMode: 'advanced',
          dcaTimes: 2,
          dcaLevels: [{ percent: -10 }, { percent: -20 }, { percent: -30 }],
        },
      })
    ).toEqual([-10, -20]);

    expect(
      resolveDcaPlannedLevelsFromStrategyConfig({
        additional: {
          dcaEnabled: true,
          dcaMode: 'basic',
          dcaTimes: 3,
          dcaLevels: [{ percent: -15 }],
        },
      })
    ).toEqual([-15, -15, -15]);
  });
});
