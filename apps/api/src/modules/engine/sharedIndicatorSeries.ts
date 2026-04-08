export const clampPeriod = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(2, Math.floor(parsed));
};

export const computeEmaSeriesFromCloses = (
  closes: number[],
  period: number
): Array<number | null> => {
  const alpha = 2 / (period + 1);
  let ema: number | null = null;
  const output: Array<number | null> = [];
  for (let index = 0; index < closes.length; index += 1) {
    const price = closes[index];
    if (!Number.isFinite(price)) {
      output.push(null);
      continue;
    }
    if (ema === null) ema = price;
    else ema = alpha * price + (1 - alpha) * ema;
    output.push(index + 1 >= period ? ema : null);
  }
  return output;
};

export const computeSmaSeriesFromCloses = (
  closes: number[],
  period: number
): Array<number | null> => {
  const output: Array<number | null> = [];
  let rollingSum = 0;

  for (let index = 0; index < closes.length; index += 1) {
    const price = closes[index];
    if (!Number.isFinite(price)) {
      output.push(null);
      continue;
    }

    rollingSum += price;
    if (index >= period) {
      rollingSum -= closes[index - period];
    }

    if (index + 1 >= period) {
      output.push(rollingSum / period);
    } else {
      output.push(null);
    }
  }

  return output;
};

const computeSmaSeriesFromNullableValues = (
  values: Array<number | null>,
  period: number
): Array<number | null> => {
  const output: Array<number | null> = [];
  for (let index = 0; index < values.length; index += 1) {
    if (index + 1 < period) {
      output.push(null);
      continue;
    }

    const window = values.slice(index - period + 1, index + 1);
    if (window.some((item) => typeof item !== 'number' || !Number.isFinite(item))) {
      output.push(null);
      continue;
    }

    const sum = window.reduce<number>((acc, item) => acc + (item as number), 0);
    output.push(sum / period);
  }
  return output;
};

const computeEmaSeriesFromNullableValues = (
  values: Array<number | null>,
  period: number
): Array<number | null> => {
  const alpha = 2 / (period + 1);
  const output: Array<number | null> = [];
  let ema: number | null = null;
  let seenFinite = 0;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      output.push(null);
      continue;
    }

    seenFinite += 1;
    if (ema === null) ema = value;
    else ema = alpha * value + (1 - alpha) * ema;
    output.push(seenFinite >= period ? ema : null);
  }

  return output;
};

export const computeMacdSeriesFromCloses = (
  closes: number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number
): {
  line: Array<number | null>;
  signal: Array<number | null>;
  histogram: Array<number | null>;
} => {
  const fast = computeEmaSeriesFromCloses(closes, fastPeriod);
  const slow = computeEmaSeriesFromCloses(closes, slowPeriod);

  const line = closes.map((_, index) => {
    const fastValue = fast[index];
    const slowValue = slow[index];
    if (typeof fastValue !== 'number' || typeof slowValue !== 'number') return null;
    return fastValue - slowValue;
  });

  const signal = computeEmaSeriesFromNullableValues(line, signalPeriod);
  const histogram = line.map((lineValue, index) => {
    const signalValue = signal[index];
    if (typeof lineValue !== 'number' || typeof signalValue !== 'number') return null;
    return lineValue - signalValue;
  });

  return {
    line,
    signal,
    histogram,
  };
};

export const computeStochRsiSeriesFromCloses = (
  closes: number[],
  rsiPeriod: number,
  stochPeriod: number,
  smoothK: number,
  smoothD: number
): {
  k: Array<number | null>;
  d: Array<number | null>;
} => {
  const rsi = computeRsiSeriesFromCloses(closes, rsiPeriod);
  const rawStoch = rsi.map((value, index) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    if (index + 1 < stochPeriod) return null;

    const window = rsi.slice(index - stochPeriod + 1, index + 1);
    const numericWindow = window.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
    if (numericWindow.length !== stochPeriod) return null;
    const highest = Math.max(...numericWindow);
    const lowest = Math.min(...numericWindow);
    if (highest === lowest) return null;

    return ((value - lowest) / (highest - lowest)) * 100;
  });

  const k = computeSmaSeriesFromNullableValues(rawStoch, smoothK);
  const d = computeSmaSeriesFromNullableValues(k, smoothD);
  return { k, d };
};

export const computeBollingerSeriesFromCloses = (
  closes: number[],
  period: number,
  stdDevMultiplier: number
): {
  upper: Array<number | null>;
  middle: Array<number | null>;
  lower: Array<number | null>;
  bandwidth: Array<number | null>;
  percentB: Array<number | null>;
} => {
  const upper: Array<number | null> = [];
  const middle: Array<number | null> = [];
  const lower: Array<number | null> = [];
  const bandwidth: Array<number | null> = [];
  const percentB: Array<number | null> = [];

  for (let index = 0; index < closes.length; index += 1) {
    if (index + 1 < period) {
      upper.push(null);
      middle.push(null);
      lower.push(null);
      bandwidth.push(null);
      percentB.push(null);
      continue;
    }

    const window = closes.slice(index - period + 1, index + 1);
    const mean = window.reduce((acc, value) => acc + value, 0) / period;
    const variance = window.reduce((acc, value) => acc + (value - mean) ** 2, 0) / period;
    const stdDev = Math.sqrt(variance);
    const upperBand = mean + stdDevMultiplier * stdDev;
    const lowerBand = mean - stdDevMultiplier * stdDev;
    const currentClose = closes[index];

    upper.push(upperBand);
    middle.push(mean);
    lower.push(lowerBand);
    bandwidth.push(mean !== 0 ? ((upperBand - lowerBand) / mean) * 100 : null);
    percentB.push(upperBand !== lowerBand ? ((currentClose - lowerBand) / (upperBand - lowerBand)) * 100 : null);
  }

  return {
    upper,
    middle,
    lower,
    bandwidth,
    percentB,
  };
};

export const computeRsiSeriesFromCloses = (
  closes: number[],
  period: number
): Array<number | null> => {
  const output: Array<number | null> = Array.from({ length: closes.length }, () => null);
  if (closes.length <= period) return output;

  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const diff = closes[index] - closes[index - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  output[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let index = period + 1; index < closes.length; index += 1) {
    const diff = closes[index] - closes[index - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    output[index] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return output;
};

export const computeMomentumSeriesFromCloses = (
  closes: number[],
  period: number
): Array<number | null> => {
  const output: Array<number | null> = [];
  for (let index = 0; index < closes.length; index += 1) {
    if (index < period) {
      output.push(null);
      continue;
    }
    output.push(closes[index] - closes[index - period]);
  }
  return output;
};

export const computeRocSeriesFromCloses = (
  closes: number[],
  period: number
): Array<number | null> => {
  const output: Array<number | null> = [];
  for (let index = 0; index < closes.length; index += 1) {
    if (index < period) {
      output.push(null);
      continue;
    }

    const previous = closes[index - period];
    if (!Number.isFinite(previous) || previous === 0) {
      output.push(null);
      continue;
    }
    output.push(((closes[index] - previous) / previous) * 100);
  }
  return output;
};
