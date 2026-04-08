import { describe, expect, it } from 'vitest';
import { getIndicators } from './indicators.service';

describe('indicators.service', () => {
  it('exposes SMA in strategy indicator catalog', () => {
    const indicators = getIndicators();
    const names = indicators.map((indicator) => indicator.name);

    expect(names).toContain('SMA');
    expect(names).toContain('MACD');
    expect(names).toContain('ROC');
    expect(names).toContain('STOCHRSI');
    expect(names).toContain('BOLLINGER_BANDS');
    expect(names).toContain('ATR');
    expect(names).toContain('CCI');
    expect(names).toContain('ADX');
    expect(names).toContain('STOCHASTIC');
    expect(names).toContain('DONCHIAN_CHANNELS');
  });
});
