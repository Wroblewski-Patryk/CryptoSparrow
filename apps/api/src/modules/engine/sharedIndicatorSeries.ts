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
