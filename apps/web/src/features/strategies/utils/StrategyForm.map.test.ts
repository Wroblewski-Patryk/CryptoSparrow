import { describe, expect, it } from 'vitest';
import { formToPayload } from './StrategyForm.map';
import { StrategyFormState } from '../types/StrategyForm.type';

const baseForm = (): StrategyFormState => ({
  name: 'Test strategy',
  description: '',
  interval: '5m',
  leverage: 5,
  walletRisk: 1,
  openConditions: {
    direction: 'both',
    indicatorsLong: [],
    indicatorsShort: [],
  },
  closeConditions: {
    mode: 'basic',
    tp: 2,
    sl: 1,
    ttp: [],
    tsl: [],
  },
  additional: {
    dcaEnabled: true,
    dcaMode: 'basic',
    dcaTimes: 2,
    dcaMultiplier: 2,
    dcaLevels: [{ percent: -20, multiplier: 2 }],
    maxPositions: 1,
    maxOrders: 1,
    positionLifetime: 1,
    positionUnit: 'h',
    orderLifetime: 1,
    orderUnit: 'h',
    marginMode: 'CROSSED',
  },
});

describe('formToPayload', () => {
  it('keeps signed basic DCA trigger percent', () => {
    const payload = formToPayload(baseForm());
    const additional = payload.config.additional as {
      dcaLevels: Array<{ percent: number; multiplier: number }>;
      dcaTimes: number;
    };
    expect(additional.dcaLevels[0].percent).toBe(-20);
    expect(additional.dcaTimes).toBe(2);
  });

  it('uses all advanced DCA levels and aligns dcaTimes with ladder length', () => {
    const form = baseForm();
    form.additional.dcaMode = 'advanced';
    form.additional.dcaTimes = 1;
    form.additional.dcaLevels = [
      { percent: -10, multiplier: 1 },
      { percent: 10, multiplier: 1.5 },
    ];

    const payload = formToPayload(form);
    const additional = payload.config.additional as {
      dcaLevels: Array<{ percent: number; multiplier: number }>;
      dcaTimes: number;
    };
    expect(additional.dcaLevels).toHaveLength(2);
    expect(additional.dcaTimes).toBe(2);
  });
});

