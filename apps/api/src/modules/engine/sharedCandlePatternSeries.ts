export type CandlePatternName =
  | 'BULLISH_ENGULFING'
  | 'BEARISH_ENGULFING'
  | 'HAMMER'
  | 'SHOOTING_STAR'
  | 'DOJI'
  | 'MORNING_STAR'
  | 'EVENING_STAR'
  | 'INSIDE_BAR'
  | 'OUTSIDE_BAR';

export type CandlePatternParams = {
  dojiBodyToRangeMax?: number;
  hammerBodyToRangeMax?: number;
  hammerLowerShadowToBodyMin?: number;
  hammerUpperShadowToBodyMax?: number;
  shootingStarBodyToRangeMax?: number;
  shootingStarUpperShadowToBodyMin?: number;
  shootingStarLowerShadowToBodyMax?: number;
  starSmallBodyToFirstBodyMax?: number;
};

export type OhlcPatternCandle = {
  open: number;
  high: number;
  low: number;
  close: number;
};

const isFiniteCandle = (candle: OhlcPatternCandle | undefined) =>
  Boolean(
    candle &&
      Number.isFinite(candle.open) &&
      Number.isFinite(candle.high) &&
      Number.isFinite(candle.low) &&
      Number.isFinite(candle.close)
  );

const bodySize = (candle: OhlcPatternCandle) => Math.abs(candle.close - candle.open);
const candleRange = (candle: OhlcPatternCandle) => candle.high - candle.low;
const upperShadow = (candle: OhlcPatternCandle) => candle.high - Math.max(candle.open, candle.close);
const lowerShadow = (candle: OhlcPatternCandle) => Math.min(candle.open, candle.close) - candle.low;
const isBullish = (candle: OhlcPatternCandle) => candle.close > candle.open;
const isBearish = (candle: OhlcPatternCandle) => candle.close < candle.open;

const detectBullishEngulfing = (candles: OhlcPatternCandle[], index: number) => {
  if (index < 1) return false;
  const previous = candles[index - 1];
  const current = candles[index];
  if (!isFiniteCandle(previous) || !isFiniteCandle(current)) return false;
  if (!isBearish(previous) || !isBullish(current)) return false;
  return current.open <= previous.close && current.close >= previous.open;
};

const detectBearishEngulfing = (candles: OhlcPatternCandle[], index: number) => {
  if (index < 1) return false;
  const previous = candles[index - 1];
  const current = candles[index];
  if (!isFiniteCandle(previous) || !isFiniteCandle(current)) return false;
  if (!isBullish(previous) || !isBearish(current)) return false;
  return current.open >= previous.close && current.close <= previous.open;
};

const detectHammer = (
  candles: OhlcPatternCandle[],
  index: number,
  params: CandlePatternParams
) => {
  const candle = candles[index];
  if (!isFiniteCandle(candle)) return false;
  const range = candleRange(candle);
  const body = bodySize(candle);
  if (range <= 0 || body <= 0) return false;

  const bodyToRangeMax = params.hammerBodyToRangeMax ?? 0.35;
  const lowerToBodyMin = params.hammerLowerShadowToBodyMin ?? 2;
  const upperToBodyMax = params.hammerUpperShadowToBodyMax ?? 0.7;

  const lower = lowerShadow(candle);
  const upper = upperShadow(candle);
  return body / range <= bodyToRangeMax && lower / body >= lowerToBodyMin && upper / body <= upperToBodyMax;
};

const detectShootingStar = (
  candles: OhlcPatternCandle[],
  index: number,
  params: CandlePatternParams
) => {
  const candle = candles[index];
  if (!isFiniteCandle(candle)) return false;
  const range = candleRange(candle);
  const body = bodySize(candle);
  if (range <= 0 || body <= 0) return false;

  const bodyToRangeMax = params.shootingStarBodyToRangeMax ?? 0.35;
  const upperToBodyMin = params.shootingStarUpperShadowToBodyMin ?? 2;
  const lowerToBodyMax = params.shootingStarLowerShadowToBodyMax ?? 0.7;

  const lower = lowerShadow(candle);
  const upper = upperShadow(candle);
  return body / range <= bodyToRangeMax && upper / body >= upperToBodyMin && lower / body <= lowerToBodyMax;
};

const detectDoji = (candles: OhlcPatternCandle[], index: number, params: CandlePatternParams) => {
  const candle = candles[index];
  if (!isFiniteCandle(candle)) return false;
  const range = candleRange(candle);
  if (range <= 0) return false;
  const body = bodySize(candle);
  const bodyToRangeMax = params.dojiBodyToRangeMax ?? 0.1;
  return body / range <= bodyToRangeMax;
};

const detectMorningStar = (
  candles: OhlcPatternCandle[],
  index: number,
  params: CandlePatternParams
) => {
  if (index < 2) return false;
  const first = candles[index - 2];
  const second = candles[index - 1];
  const third = candles[index];
  if (!isFiniteCandle(first) || !isFiniteCandle(second) || !isFiniteCandle(third)) return false;

  const firstBody = bodySize(first);
  const secondBody = bodySize(second);
  if (firstBody <= 0) return false;
  const smallBodyRatio = params.starSmallBodyToFirstBodyMax ?? 0.6;

  return (
    isBearish(first) &&
    secondBody <= firstBody * smallBodyRatio &&
    isBullish(third) &&
    third.close >= (first.open + first.close) / 2
  );
};

const detectEveningStar = (
  candles: OhlcPatternCandle[],
  index: number,
  params: CandlePatternParams
) => {
  if (index < 2) return false;
  const first = candles[index - 2];
  const second = candles[index - 1];
  const third = candles[index];
  if (!isFiniteCandle(first) || !isFiniteCandle(second) || !isFiniteCandle(third)) return false;

  const firstBody = bodySize(first);
  const secondBody = bodySize(second);
  if (firstBody <= 0) return false;
  const smallBodyRatio = params.starSmallBodyToFirstBodyMax ?? 0.6;

  return (
    isBullish(first) &&
    secondBody <= firstBody * smallBodyRatio &&
    isBearish(third) &&
    third.close <= (first.open + first.close) / 2
  );
};

const detectInsideBar = (candles: OhlcPatternCandle[], index: number) => {
  if (index < 1) return false;
  const previous = candles[index - 1];
  const current = candles[index];
  if (!isFiniteCandle(previous) || !isFiniteCandle(current)) return false;
  return current.high < previous.high && current.low > previous.low;
};

const detectOutsideBar = (candles: OhlcPatternCandle[], index: number) => {
  if (index < 1) return false;
  const previous = candles[index - 1];
  const current = candles[index];
  if (!isFiniteCandle(previous) || !isFiniteCandle(current)) return false;
  return current.high > previous.high && current.low < previous.low;
};

export const computeCandlePatternSeries = (
  candles: OhlcPatternCandle[],
  pattern: CandlePatternName,
  params: CandlePatternParams = {}
): boolean[] =>
  candles.map((_, index) => {
    if (pattern === 'BULLISH_ENGULFING') return detectBullishEngulfing(candles, index);
    if (pattern === 'BEARISH_ENGULFING') return detectBearishEngulfing(candles, index);
    if (pattern === 'HAMMER') return detectHammer(candles, index, params);
    if (pattern === 'SHOOTING_STAR') return detectShootingStar(candles, index, params);
    if (pattern === 'DOJI') return detectDoji(candles, index, params);
    if (pattern === 'MORNING_STAR') return detectMorningStar(candles, index, params);
    if (pattern === 'EVENING_STAR') return detectEveningStar(candles, index, params);
    if (pattern === 'INSIDE_BAR') return detectInsideBar(candles, index);
    return detectOutsideBar(candles, index);
  });
