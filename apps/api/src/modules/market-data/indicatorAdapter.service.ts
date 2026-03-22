import { OhlcvCandle } from './marketData.types';
import {
  IndicatorAdapter,
  IndicatorRequest,
  IndicatorRequestSchema,
  IndicatorResultPoint,
} from './indicatorAdapter.types';

const round = (value: number) => Math.round(value * 100_000) / 100_000;

const sma = (values: number[], period: number): Array<number | null> => {
  return values.map((_, idx) => {
    if (idx + 1 < period) return null;
    const window = values.slice(idx + 1 - period, idx + 1);
    const sum = window.reduce((acc, current) => acc + current, 0);
    return round(sum / period);
  });
};

const ema = (values: number[], period: number): Array<number | null> => {
  const multiplier = 2 / (period + 1);
  const result: Array<number | null> = Array.from({ length: values.length }, () => null);

  if (values.length < period) return result;

  const seedSlice = values.slice(0, period);
  const seedSma = seedSlice.reduce((acc, current) => acc + current, 0) / period;
  result[period - 1] = round(seedSma);

  let prev = seedSma;
  for (let i = period; i < values.length; i += 1) {
    prev = (values[i] - prev) * multiplier + prev;
    result[i] = round(prev);
  }

  return result;
};

const rsi = (values: number[], period: number): Array<number | null> => {
  const result: Array<number | null> = Array.from({ length: values.length }, () => null);
  if (values.length <= period) return result;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const delta = values[i] - values[i - 1];
    if (delta >= 0) gains += delta;
    else losses -= delta;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  result[period] = avgLoss === 0 ? 100 : round(100 - 100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < values.length; i += 1) {
    const delta = values[i] - values[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    result[i] = avgLoss === 0 ? 100 : round(100 - 100 / (1 + avgGain / avgLoss));
  }

  return result;
};

export class DefaultIndicatorAdapter implements IndicatorAdapter {
  calculate(input: IndicatorRequest, candles: OhlcvCandle[]): IndicatorResultPoint[] {
    const parsed = IndicatorRequestSchema.parse(input);
    const closes = candles.map((candle) => candle.close);

    let computed: Array<number | null>;
    if (parsed.kind === 'SMA') {
      computed = sma(closes, parsed.period);
    } else if (parsed.kind === 'EMA') {
      computed = ema(closes, parsed.period);
    } else {
      computed = rsi(closes, parsed.period);
    }

    return candles.map((candle, idx) => ({
      timestamp: candle.timestamp,
      value: computed[idx],
    }));
  }
}
