import { describe, expect, it } from 'vitest';
import { buildPairStatsMetricDisplay } from './pairStatsMetricDisplay';

describe('buildPairStatsMetricDisplay', () => {
  const format = (value: number) => value.toFixed(2);

  it('shows only one value when chart window and total are equal', () => {
    const result = buildPairStatsMetricDisplay({
      visibleValue: 120,
      totalValue: 120,
      formatValue: format,
    });

    expect(result.primary).toBe('120.00');
    expect(result.chartWindow).toBeNull();
    expect(result.hasChartWindowDelta).toBe(false);
  });

  it('shows total as primary and chart window as secondary when values differ', () => {
    const result = buildPairStatsMetricDisplay({
      visibleValue: 98,
      totalValue: 120,
      formatValue: format,
    });

    expect(result.primary).toBe('120.00');
    expect(result.chartWindow).toBe('98.00');
    expect(result.hasChartWindowDelta).toBe(true);
  });

  it('respects tolerance for floating-point drift', () => {
    const result = buildPairStatsMetricDisplay({
      visibleValue: 100.0000001,
      totalValue: 100,
      formatValue: format,
      differenceTolerance: 0.001,
    });

    expect(result.chartWindow).toBeNull();
    expect(result.hasChartWindowDelta).toBe(false);
  });
});

