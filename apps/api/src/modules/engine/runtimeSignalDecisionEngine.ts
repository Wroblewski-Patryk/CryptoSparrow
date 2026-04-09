import {
  evaluateStrategySignalAtIndex,
  parseStrategySignalRules,
} from './strategySignalEvaluator';
import {
  computeAdxSeriesFromCandles,
  computeAtrSeriesFromCandles,
  computeBollingerSeriesFromCloses,
  computeCciSeriesFromCandles,
  computeDonchianSeriesFromCandles,
  clampPeriod,
  computeEmaSeriesFromCloses,
  computeMacdSeriesFromCloses,
  computeMomentumSeriesFromCloses,
  computeRollingZScoreSeriesFromNullableValues,
  computeRocSeriesFromCloses,
  computeRsiSeriesFromCloses,
  computeSmaSeriesFromNullableValues,
  computeSmaSeriesFromCloses,
  computeStochasticSeriesFromCandles,
  computeStochRsiSeriesFromCloses,
} from './sharedIndicatorSeries';
import {
  CandlePatternParams,
  computeCandlePatternSeries,
  resolveCandlePatternName,
} from './sharedCandlePatternSeries';
import {
  RuntimeSignalConditionLine,
  StrategyEvaluation,
} from './runtimeSignalEvaluationTypes';
import {
  ActiveBotStrategy,
  formatIndicatorValue,
  formatRuleTarget,
  resolvePatternParams,
} from './runtimeSignalLoopDefaults';

type RuntimeCandle = {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type RuntimeOrderBookSeries = {
  orderBookImbalance: Array<number | null>;
  orderBookSpreadBps: Array<number | null>;
  orderBookDepthRatio: Array<number | null>;
};

type RuntimeSignalDecisionEngineDeps = {
  getSeries: (
    marketType: 'FUTURES' | 'SPOT',
    symbol: string,
    interval?: string | null,
  ) => RuntimeCandle[] | null;
  resolveFundingRateSeriesForCandles: (
    marketType: 'FUTURES' | 'SPOT',
    symbol: string,
    candles: RuntimeCandle[],
  ) => Array<number | null> | null;
  resolveOpenInterestSeriesForCandles: (
    marketType: 'FUTURES' | 'SPOT',
    symbol: string,
    candles: RuntimeCandle[],
  ) => Array<number | null> | null;
  resolveOrderBookSeriesForCandles: (
    marketType: 'FUTURES' | 'SPOT',
    symbol: string,
    candles: RuntimeCandle[],
  ) => RuntimeOrderBookSeries | null;
};

export class RuntimeSignalDecisionEngine {
  constructor(private readonly deps: RuntimeSignalDecisionEngineDeps) {}

  evaluateStrategy(input: {
    marketType: 'FUTURES' | 'SPOT';
    symbol: string;
    strategy: ActiveBotStrategy;
    decisionOpenTime: number;
  }): StrategyEvaluation {
    const { marketType, symbol, strategy, decisionOpenTime } = input;
    if (!strategy.strategyConfig) {
      return {
        direction: null,
        conditionLines: [],
        indicatorSummary: null,
      };
    }
    const signalRules = parseStrategySignalRules(strategy.strategyConfig);
    if (!signalRules) {
      return {
        direction: null,
        conditionLines: [],
        indicatorSummary: null,
      };
    }

    const candles = this.deps.getSeries(marketType, symbol, strategy.strategyInterval);
    if (!candles || candles.length === 0) {
      return {
        direction: null,
        conditionLines: [],
        indicatorSummary: null,
      };
    }
    const latestIndex = candles.length - 1;
    const decisionIndex = (() => {
      const exactIndex = candles.findIndex((candle) => candle.openTime === decisionOpenTime);
      if (exactIndex >= 0) return exactIndex;

      for (let index = candles.length - 1; index >= 0; index -= 1) {
        if (candles[index].openTime <= decisionOpenTime) return index;
      }

      return latestIndex;
    })();
    const closes = candles.map((candle) => candle.close);
    const fundingRateSeries = this.deps.resolveFundingRateSeriesForCandles(
      marketType,
      symbol,
      candles,
    );
    const openInterestSeries = this.deps.resolveOpenInterestSeriesForCandles(
      marketType,
      symbol,
      candles,
    );
    const orderBookSeries = this.deps.resolveOrderBookSeriesForCandles(
      marketType,
      symbol,
      candles,
    );
    const indicatorCache = new Map<string, Array<number | null>>();
    const direction = evaluateStrategySignalAtIndex(
      signalRules,
      candles,
      decisionIndex,
      indicatorCache,
      fundingRateSeries || openInterestSeries || orderBookSeries
        ? {
            derivatives: {
              ...(fundingRateSeries ? { fundingRate: fundingRateSeries } : {}),
              ...(openInterestSeries ? { openInterest: openInterestSeries } : {}),
              ...(orderBookSeries
                ? {
                    orderBookImbalance: orderBookSeries.orderBookImbalance,
                    orderBookSpreadBps: orderBookSeries.orderBookSpreadBps,
                    orderBookDepthRatio: orderBookSeries.orderBookDepthRatio,
                  }
                : {}),
            },
          }
        : undefined,
    );

    const ensureEma = (period: number) => {
      const key = `EMA_${period}`;
      if (!indicatorCache.has(key)) {
        indicatorCache.set(key, computeEmaSeriesFromCloses(closes, period));
      }
      return indicatorCache.get(key)!;
    };
    const ensureRsi = (period: number) => {
      const key = `RSI_${period}`;
      if (!indicatorCache.has(key)) {
        indicatorCache.set(key, computeRsiSeriesFromCloses(closes, period));
      }
      return indicatorCache.get(key)!;
    };
    const ensureSma = (period: number) => {
      const key = `SMA_${period}`;
      if (!indicatorCache.has(key)) {
        indicatorCache.set(key, computeSmaSeriesFromCloses(closes, period));
      }
      return indicatorCache.get(key)!;
    };
    const ensureMomentum = (period: number) => {
      const key = `MOMENTUM_${period}`;
      if (!indicatorCache.has(key)) {
        indicatorCache.set(key, computeMomentumSeriesFromCloses(closes, period));
      }
      return indicatorCache.get(key)!;
    };
    const ensureFundingRate = () => {
      const key = 'FUNDING_RATE_RAW';
      if (!indicatorCache.has(key)) {
        const normalized = candles.map((_, index) => {
          const value = fundingRateSeries?.[index];
          return typeof value === 'number' && Number.isFinite(value) ? value : null;
        });
        indicatorCache.set(key, normalized);
      }
      return indicatorCache.get(key)!;
    };
    const ensureFundingRateZScore = (period: number) => {
      const key = `FUNDING_RATE_ZSCORE_${period}`;
      if (!indicatorCache.has(key)) {
        indicatorCache.set(
          key,
          computeRollingZScoreSeriesFromNullableValues(ensureFundingRate(), period),
        );
      }
      return indicatorCache.get(key)!;
    };
    const ensureOpenInterest = () => {
      const key = 'OPEN_INTEREST_RAW';
      if (!indicatorCache.has(key)) {
        const normalized = candles.map((_, index) => {
          const value = openInterestSeries?.[index];
          return typeof value === 'number' && Number.isFinite(value) ? value : null;
        });
        indicatorCache.set(key, normalized);
      }
      return indicatorCache.get(key)!;
    };
    const ensureOpenInterestDelta = () => {
      const key = 'OPEN_INTEREST_DELTA';
      if (!indicatorCache.has(key)) {
        const delta = ensureOpenInterest().map((value, index, source) => {
          if (index === 0 || typeof value !== 'number') return null;
          const previous = source[index - 1];
          if (typeof previous !== 'number') return null;
          return value - previous;
        });
        indicatorCache.set(key, delta);
      }
      return indicatorCache.get(key)!;
    };
    const ensureOpenInterestMa = (period: number) => {
      const key = `OPEN_INTEREST_MA_${period}`;
      if (!indicatorCache.has(key)) {
        indicatorCache.set(
          key,
          computeSmaSeriesFromNullableValues(ensureOpenInterest(), period),
        );
      }
      return indicatorCache.get(key)!;
    };
    const ensureOpenInterestZScore = (period: number) => {
      const key = `OPEN_INTEREST_ZSCORE_${period}`;
      if (!indicatorCache.has(key)) {
        indicatorCache.set(
          key,
          computeRollingZScoreSeriesFromNullableValues(ensureOpenInterest(), period),
        );
      }
      return indicatorCache.get(key)!;
    };
    const ensureOrderBookImbalance = () => {
      const key = 'ORDER_BOOK_IMBALANCE';
      if (!indicatorCache.has(key)) {
        const normalized = candles.map((_, index) => {
          const value = orderBookSeries?.orderBookImbalance[index];
          return typeof value === 'number' && Number.isFinite(value) ? value : null;
        });
        indicatorCache.set(key, normalized);
      }
      return indicatorCache.get(key)!;
    };
    const ensureOrderBookSpreadBps = () => {
      const key = 'ORDER_BOOK_SPREAD_BPS';
      if (!indicatorCache.has(key)) {
        const normalized = candles.map((_, index) => {
          const value = orderBookSeries?.orderBookSpreadBps[index];
          return typeof value === 'number' && Number.isFinite(value) ? value : null;
        });
        indicatorCache.set(key, normalized);
      }
      return indicatorCache.get(key)!;
    };
    const ensureOrderBookDepthRatio = () => {
      const key = 'ORDER_BOOK_DEPTH_RATIO';
      if (!indicatorCache.has(key)) {
        const normalized = candles.map((_, index) => {
          const value = orderBookSeries?.orderBookDepthRatio[index];
          return typeof value === 'number' && Number.isFinite(value) ? value : null;
        });
        indicatorCache.set(key, normalized);
      }
      return indicatorCache.get(key)!;
    };
    const ensureRoc = (period: number) => {
      const key = `ROC_${period}`;
      if (!indicatorCache.has(key)) {
        indicatorCache.set(key, computeRocSeriesFromCloses(closes, period));
      }
      return indicatorCache.get(key)!;
    };
    const ensureAtr = (period: number) => {
      const key = `ATR_${period}`;
      if (!indicatorCache.has(key)) {
        const highs = candles.map((candle) => candle.high);
        const lows = candles.map((candle) => candle.low);
        indicatorCache.set(key, computeAtrSeriesFromCandles(highs, lows, closes, period));
      }
      return indicatorCache.get(key)!;
    };
    const ensureCci = (period: number) => {
      const key = `CCI_${period}`;
      if (!indicatorCache.has(key)) {
        const highs = candles.map((candle) => candle.high);
        const lows = candles.map((candle) => candle.low);
        indicatorCache.set(key, computeCciSeriesFromCandles(highs, lows, closes, period));
      }
      return indicatorCache.get(key)!;
    };
    const ensureAdx = (period: number) => {
      const baseKey = `ADX_${period}`;
      const adxKey = `${baseKey}_ADX`;
      const plusKey = `${baseKey}_DI_PLUS`;
      const minusKey = `${baseKey}_DI_MINUS`;
      if (!indicatorCache.has(adxKey) || !indicatorCache.has(plusKey) || !indicatorCache.has(minusKey)) {
        const highs = candles.map((candle) => candle.high);
        const lows = candles.map((candle) => candle.low);
        const adx = computeAdxSeriesFromCandles(highs, lows, closes, period);
        indicatorCache.set(adxKey, adx.adx);
        indicatorCache.set(plusKey, adx.plusDi);
        indicatorCache.set(minusKey, adx.minusDi);
      }
      return {
        adx: indicatorCache.get(adxKey)!,
        plusDi: indicatorCache.get(plusKey)!,
        minusDi: indicatorCache.get(minusKey)!,
      };
    };
    const ensureStochastic = (period: number, smoothK: number, smoothD: number) => {
      const baseKey = `STOCHASTIC_${period}_${smoothK}_${smoothD}`;
      const kKey = `${baseKey}_K`;
      const dKey = `${baseKey}_D`;
      if (!indicatorCache.has(kKey) || !indicatorCache.has(dKey)) {
        const highs = candles.map((candle) => candle.high);
        const lows = candles.map((candle) => candle.low);
        const stochastic = computeStochasticSeriesFromCandles(highs, lows, closes, period, smoothK, smoothD);
        indicatorCache.set(kKey, stochastic.k);
        indicatorCache.set(dKey, stochastic.d);
      }
      return {
        k: indicatorCache.get(kKey)!,
        d: indicatorCache.get(dKey)!,
      };
    };
    const ensureMacd = (fast: number, slow: number, signal: number) => {
      const baseKey = `MACD_${fast}_${slow}_${signal}`;
      const lineKey = `${baseKey}_LINE`;
      const signalKey = `${baseKey}_SIGNAL`;
      const histogramKey = `${baseKey}_HISTOGRAM`;

      if (!indicatorCache.has(lineKey) || !indicatorCache.has(signalKey) || !indicatorCache.has(histogramKey)) {
        const macd = computeMacdSeriesFromCloses(closes, fast, slow, signal);
        indicatorCache.set(lineKey, macd.line);
        indicatorCache.set(signalKey, macd.signal);
        indicatorCache.set(histogramKey, macd.histogram);
      }

      return {
        line: indicatorCache.get(lineKey)!,
        signal: indicatorCache.get(signalKey)!,
        histogram: indicatorCache.get(histogramKey)!,
      };
    };
    const ensureStochRsi = (period: number, stochPeriod: number, smoothK: number, smoothD: number) => {
      const baseKey = `STOCHRSI_${period}_${stochPeriod}_${smoothK}_${smoothD}`;
      const kKey = `${baseKey}_K`;
      const dKey = `${baseKey}_D`;

      if (!indicatorCache.has(kKey) || !indicatorCache.has(dKey)) {
        const stochRsi = computeStochRsiSeriesFromCloses(closes, period, stochPeriod, smoothK, smoothD);
        indicatorCache.set(kKey, stochRsi.k);
        indicatorCache.set(dKey, stochRsi.d);
      }

      return {
        k: indicatorCache.get(kKey)!,
        d: indicatorCache.get(dKey)!,
      };
    };
    const ensureBollinger = (period: number, stdDev: number) => {
      const baseKey = `BOLLINGER_${period}_${stdDev}`;
      const upperKey = `${baseKey}_UPPER`;
      const middleKey = `${baseKey}_MIDDLE`;
      const lowerKey = `${baseKey}_LOWER`;
      const bandwidthKey = `${baseKey}_BANDWIDTH`;
      const percentBKey = `${baseKey}_PERCENT_B`;

      if (
        !indicatorCache.has(upperKey) ||
        !indicatorCache.has(middleKey) ||
        !indicatorCache.has(lowerKey) ||
        !indicatorCache.has(bandwidthKey) ||
        !indicatorCache.has(percentBKey)
      ) {
        const bollinger = computeBollingerSeriesFromCloses(closes, period, stdDev);
        indicatorCache.set(upperKey, bollinger.upper);
        indicatorCache.set(middleKey, bollinger.middle);
        indicatorCache.set(lowerKey, bollinger.lower);
        indicatorCache.set(bandwidthKey, bollinger.bandwidth);
        indicatorCache.set(percentBKey, bollinger.percentB);
      }

      return {
        upper: indicatorCache.get(upperKey)!,
        middle: indicatorCache.get(middleKey)!,
        lower: indicatorCache.get(lowerKey)!,
        bandwidth: indicatorCache.get(bandwidthKey)!,
        percentB: indicatorCache.get(percentBKey)!,
      };
    };
    const ensureDonchian = (period: number) => {
      const baseKey = `DONCHIAN_${period}`;
      const upperKey = `${baseKey}_UPPER`;
      const middleKey = `${baseKey}_MIDDLE`;
      const lowerKey = `${baseKey}_LOWER`;
      if (!indicatorCache.has(upperKey) || !indicatorCache.has(middleKey) || !indicatorCache.has(lowerKey)) {
        const highs = candles.map((candle) => candle.high);
        const lows = candles.map((candle) => candle.low);
        const donchian = computeDonchianSeriesFromCandles(highs, lows, period);
        indicatorCache.set(upperKey, donchian.upper);
        indicatorCache.set(middleKey, donchian.middle);
        indicatorCache.set(lowerKey, donchian.lower);
      }
      return {
        upper: indicatorCache.get(upperKey)!,
        middle: indicatorCache.get(middleKey)!,
        lower: indicatorCache.get(lowerKey)!,
      };
    };
    const ensurePattern = (patternName: string, rawParams: Record<string, unknown>) => {
      const pattern = resolveCandlePatternName(patternName);
      if (!pattern) return null;
      const patternParams = resolvePatternParams(rawParams);
      const key = `PATTERN_${pattern}_${JSON.stringify(patternParams)}`;
      if (!indicatorCache.has(key)) {
        const patternCandles = candles.map((candle) => ({
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        }));
        const values = computeCandlePatternSeries(patternCandles, pattern, patternParams).map((value) => (value ? 1 : 0));
        indicatorCache.set(key, values);
      }
      return indicatorCache.get(key) ?? null;
    };

    const conditionLines: RuntimeSignalConditionLine[] = [];
    const indicatorParts: string[] = [];
    const indicatorKeys = new Set<string>();
    const pushRule = (
      scope: 'LONG' | 'SHORT',
      rule: { name: string; condition: string; value: number; params: Record<string, unknown> }
    ) => {
      const indicator = rule.name.toUpperCase();
      if (indicator.includes('FUNDING_RATE_ZSCORE')) {
        const period = clampPeriod(
          rule.params.zScorePeriod ?? rule.params.period ?? rule.params.length,
          20,
        );
        const value = ensureFundingRateZScore(period)[decisionIndex];
        conditionLines.push({
          scope,
          left: `FUNDING_RATE_ZSCORE(${period})`,
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`FUNDING_RATE_ZSCORE(${period})`)) {
          indicatorKeys.add(`FUNDING_RATE_ZSCORE(${period})`);
          indicatorParts.push(
            `FUNDING_RATE_ZSCORE(${period})=${formatIndicatorValue(value)}`,
          );
        }
        return;
      }

      if (indicator.includes('FUNDING_RATE')) {
        const value = ensureFundingRate()[decisionIndex];
        conditionLines.push({
          scope,
          left: 'FUNDING_RATE',
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has('FUNDING_RATE')) {
          indicatorKeys.add('FUNDING_RATE');
          indicatorParts.push(`FUNDING_RATE=${formatIndicatorValue(value)}`);
        }
        return;
      }

      if (indicator.includes('OPEN_INTEREST_ZSCORE')) {
        const period = clampPeriod(
          rule.params.zScorePeriod ?? rule.params.period ?? rule.params.length,
          20,
        );
        const value = ensureOpenInterestZScore(period)[decisionIndex];
        conditionLines.push({
          scope,
          left: `OPEN_INTEREST_ZSCORE(${period})`,
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`OPEN_INTEREST_ZSCORE(${period})`)) {
          indicatorKeys.add(`OPEN_INTEREST_ZSCORE(${period})`);
          indicatorParts.push(
            `OPEN_INTEREST_ZSCORE(${period})=${formatIndicatorValue(value)}`,
          );
        }
        return;
      }

      if (indicator.includes('OPEN_INTEREST_MA')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 20);
        const value = ensureOpenInterestMa(period)[decisionIndex];
        conditionLines.push({
          scope,
          left: `OPEN_INTEREST_MA(${period})`,
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`OPEN_INTEREST_MA(${period})`)) {
          indicatorKeys.add(`OPEN_INTEREST_MA(${period})`);
          indicatorParts.push(
            `OPEN_INTEREST_MA(${period})=${formatIndicatorValue(value)}`,
          );
        }
        return;
      }

      if (indicator.includes('OPEN_INTEREST_DELTA')) {
        const value = ensureOpenInterestDelta()[decisionIndex];
        conditionLines.push({
          scope,
          left: 'OPEN_INTEREST_DELTA',
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has('OPEN_INTEREST_DELTA')) {
          indicatorKeys.add('OPEN_INTEREST_DELTA');
          indicatorParts.push(
            `OPEN_INTEREST_DELTA=${formatIndicatorValue(value)}`,
          );
        }
        return;
      }

      if (indicator.includes('OPEN_INTEREST')) {
        const value = ensureOpenInterest()[decisionIndex];
        conditionLines.push({
          scope,
          left: 'OPEN_INTEREST',
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has('OPEN_INTEREST')) {
          indicatorKeys.add('OPEN_INTEREST');
          indicatorParts.push(`OPEN_INTEREST=${formatIndicatorValue(value)}`);
        }
        return;
      }

      if (indicator.includes('ORDER_BOOK_IMBALANCE')) {
        const value = ensureOrderBookImbalance()[decisionIndex];
        conditionLines.push({
          scope,
          left: 'ORDER_BOOK_IMBALANCE',
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has('ORDER_BOOK_IMBALANCE')) {
          indicatorKeys.add('ORDER_BOOK_IMBALANCE');
          indicatorParts.push(
            `ORDER_BOOK_IMBALANCE=${formatIndicatorValue(value)}`,
          );
        }
        return;
      }

      if (indicator.includes('ORDER_BOOK_SPREAD_BPS')) {
        const value = ensureOrderBookSpreadBps()[decisionIndex];
        conditionLines.push({
          scope,
          left: 'ORDER_BOOK_SPREAD_BPS',
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has('ORDER_BOOK_SPREAD_BPS')) {
          indicatorKeys.add('ORDER_BOOK_SPREAD_BPS');
          indicatorParts.push(
            `ORDER_BOOK_SPREAD_BPS=${formatIndicatorValue(value)}`,
          );
        }
        return;
      }

      if (indicator.includes('ORDER_BOOK_DEPTH_RATIO')) {
        const value = ensureOrderBookDepthRatio()[decisionIndex];
        conditionLines.push({
          scope,
          left: 'ORDER_BOOK_DEPTH_RATIO',
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has('ORDER_BOOK_DEPTH_RATIO')) {
          indicatorKeys.add('ORDER_BOOK_DEPTH_RATIO');
          indicatorParts.push(
            `ORDER_BOOK_DEPTH_RATIO=${formatIndicatorValue(value)}`,
          );
        }
        return;
      }

      if (indicator.includes('EMA')) {
        const fast = clampPeriod(rule.params.fast, 9);
        const slow = clampPeriod(rule.params.slow, 21);
        const fastValue = ensureEma(fast)[decisionIndex];
        const slowValue = ensureEma(slow)[decisionIndex];
        conditionLines.push({
          scope,
          left: `EMA(${fast})`,
          value: formatIndicatorValue(fastValue),
          operator: rule.condition,
          right: `EMA(${slow})=${formatIndicatorValue(slowValue)}`,
        });
        if (!indicatorKeys.has(`EMA(${fast})`)) {
          indicatorKeys.add(`EMA(${fast})`);
          indicatorParts.push(`EMA(${fast})=${formatIndicatorValue(fastValue)}`);
        }
        if (!indicatorKeys.has(`EMA(${slow})`)) {
          indicatorKeys.add(`EMA(${slow})`);
          indicatorParts.push(`EMA(${slow})=${formatIndicatorValue(slowValue)}`);
        }
        return;
      }

      if (indicator.includes('RSI') && !indicator.includes('STOCHRSI')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
        const value = ensureRsi(period)[decisionIndex];
        conditionLines.push({
          scope,
          left: `RSI(${period})`,
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`RSI(${period})`)) {
          indicatorKeys.add(`RSI(${period})`);
          indicatorParts.push(`RSI(${period})=${formatIndicatorValue(value)}`);
        }
        return;
      }

      if (indicator.includes('SMA')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
        const value = ensureSma(period)[decisionIndex];
        conditionLines.push({
          scope,
          left: `SMA(${period})`,
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`SMA(${period})`)) {
          indicatorKeys.add(`SMA(${period})`);
          indicatorParts.push(`SMA(${period})=${formatIndicatorValue(value)}`);
        }
        return;
      }

      if (indicator.includes('MOMENTUM')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
        const value = ensureMomentum(period)[decisionIndex];
        conditionLines.push({
          scope,
          left: `MOMENTUM(${period})`,
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`MOMENTUM(${period})`)) {
          indicatorKeys.add(`MOMENTUM(${period})`);
          indicatorParts.push(`MOMENTUM(${period})=${formatIndicatorValue(value)}`);
        }
        return;
      }

      if (indicator.includes('ROC')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
        const value = ensureRoc(period)[decisionIndex];
        conditionLines.push({
          scope,
          left: `ROC(${period})`,
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`ROC(${period})`)) {
          indicatorKeys.add(`ROC(${period})`);
          indicatorParts.push(`ROC(${period})=${formatIndicatorValue(value)}`);
        }
        return;
      }

      if (indicator.includes('ATR')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
        const value = ensureAtr(period)[decisionIndex];
        conditionLines.push({
          scope,
          left: `ATR(${period})`,
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`ATR(${period})`)) {
          indicatorKeys.add(`ATR(${period})`);
          indicatorParts.push(`ATR(${period})=${formatIndicatorValue(value)}`);
        }
        return;
      }

      if (indicator.includes('CCI')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 20);
        const value = ensureCci(period)[decisionIndex];
        conditionLines.push({
          scope,
          left: `CCI(${period})`,
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`CCI(${period})`)) {
          indicatorKeys.add(`CCI(${period})`);
          indicatorParts.push(`CCI(${period})=${formatIndicatorValue(value)}`);
        }
        return;
      }

      if (indicator.includes('ADX')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
        const adx = ensureAdx(period);
        const adxValue = adx.adx[decisionIndex];
        const plusValue = adx.plusDi[decisionIndex];
        const minusValue = adx.minusDi[decisionIndex];
        conditionLines.push({
          scope,
          left: `ADX(${period})`,
          value: formatIndicatorValue(adxValue),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`ADX(${period})`)) {
          indicatorKeys.add(`ADX(${period})`);
          indicatorParts.push(`ADX(${period})=${formatIndicatorValue(adxValue)}`);
        }
        if (!indicatorKeys.has(`DI_PLUS(${period})`)) {
          indicatorKeys.add(`DI_PLUS(${period})`);
          indicatorParts.push(`DI_PLUS(${period})=${formatIndicatorValue(plusValue)}`);
        }
        if (!indicatorKeys.has(`DI_MINUS(${period})`)) {
          indicatorKeys.add(`DI_MINUS(${period})`);
          indicatorParts.push(`DI_MINUS(${period})=${formatIndicatorValue(minusValue)}`);
        }
        return;
      }

      if (indicator.includes('STOCHASTIC')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
        const smoothK = clampPeriod(rule.params.smoothK, 3);
        const smoothD = clampPeriod(rule.params.smoothD, 3);
        const stochastic = ensureStochastic(period, smoothK, smoothD);
        const kValue = stochastic.k[decisionIndex];
        const dValue = stochastic.d[decisionIndex];
        conditionLines.push({
          scope,
          left: `STOCHASTIC_K(${period},${smoothK},${smoothD})`,
          value: formatIndicatorValue(kValue),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`STOCHASTIC_K(${period},${smoothK},${smoothD})`)) {
          indicatorKeys.add(`STOCHASTIC_K(${period},${smoothK},${smoothD})`);
          indicatorParts.push(`STOCHASTIC_K(${period},${smoothK},${smoothD})=${formatIndicatorValue(kValue)}`);
        }
        if (!indicatorKeys.has(`STOCHASTIC_D(${period},${smoothK},${smoothD})`)) {
          indicatorKeys.add(`STOCHASTIC_D(${period},${smoothK},${smoothD})`);
          indicatorParts.push(`STOCHASTIC_D(${period},${smoothK},${smoothD})=${formatIndicatorValue(dValue)}`);
        }
        return;
      }

      if (indicator.includes('STOCHRSI')) {
        const period = clampPeriod(rule.params.period ?? rule.params.rsiPeriod, 14);
        const stochPeriod = clampPeriod(rule.params.stochPeriod ?? period, 14);
        const smoothK = clampPeriod(rule.params.smoothK, 3);
        const smoothD = clampPeriod(rule.params.smoothD, 3);
        const stochRsi = ensureStochRsi(period, stochPeriod, smoothK, smoothD);
        const kValue = stochRsi.k[decisionIndex];
        const dValue = stochRsi.d[decisionIndex];

        conditionLines.push({
          scope,
          left: `STOCHRSI(${period},${stochPeriod},${smoothK},${smoothD})`,
          value: formatIndicatorValue(kValue),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`STOCHRSI_K(${period},${stochPeriod},${smoothK},${smoothD})`)) {
          indicatorKeys.add(`STOCHRSI_K(${period},${stochPeriod},${smoothK},${smoothD})`);
          indicatorParts.push(
            `STOCHRSI_K(${period},${stochPeriod},${smoothK},${smoothD})=${formatIndicatorValue(kValue)}`,
          );
        }
        if (!indicatorKeys.has(`STOCHRSI_D(${period},${stochPeriod},${smoothK},${smoothD})`)) {
          indicatorKeys.add(`STOCHRSI_D(${period},${stochPeriod},${smoothK},${smoothD})`);
          indicatorParts.push(
            `STOCHRSI_D(${period},${stochPeriod},${smoothK},${smoothD})=${formatIndicatorValue(dValue)}`,
          );
        }
        return;
      }

      if (indicator.includes('BOLLINGER')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 20);
        const stdDevCandidate = Number(rule.params.stdDev ?? rule.params.deviation);
        const stdDev = Number.isFinite(stdDevCandidate) ? stdDevCandidate : 2;
        const bollinger = ensureBollinger(period, stdDev);
        const percentBValue = bollinger.percentB[decisionIndex];
        const bandwidthValue = bollinger.bandwidth[decisionIndex];

        conditionLines.push({
          scope,
          left: `BOLLINGER_PERCENT_B(${period},${stdDev})`,
          value: formatIndicatorValue(percentBValue),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`BOLLINGER_UPPER(${period},${stdDev})`)) {
          indicatorKeys.add(`BOLLINGER_UPPER(${period},${stdDev})`);
          indicatorParts.push(`BOLLINGER_UPPER(${period},${stdDev})=${formatIndicatorValue(bollinger.upper[decisionIndex])}`);
        }
        if (!indicatorKeys.has(`BOLLINGER_MIDDLE(${period},${stdDev})`)) {
          indicatorKeys.add(`BOLLINGER_MIDDLE(${period},${stdDev})`);
          indicatorParts.push(
            `BOLLINGER_MIDDLE(${period},${stdDev})=${formatIndicatorValue(bollinger.middle[decisionIndex])}`,
          );
        }
        if (!indicatorKeys.has(`BOLLINGER_LOWER(${period},${stdDev})`)) {
          indicatorKeys.add(`BOLLINGER_LOWER(${period},${stdDev})`);
          indicatorParts.push(`BOLLINGER_LOWER(${period},${stdDev})=${formatIndicatorValue(bollinger.lower[decisionIndex])}`);
        }
        if (!indicatorKeys.has(`BOLLINGER_BANDWIDTH(${period},${stdDev})`)) {
          indicatorKeys.add(`BOLLINGER_BANDWIDTH(${period},${stdDev})`);
          indicatorParts.push(`BOLLINGER_BANDWIDTH(${period},${stdDev})=${formatIndicatorValue(bandwidthValue)}`);
        }
        if (!indicatorKeys.has(`BOLLINGER_PERCENT_B(${period},${stdDev})`)) {
          indicatorKeys.add(`BOLLINGER_PERCENT_B(${period},${stdDev})`);
          indicatorParts.push(`BOLLINGER_PERCENT_B(${period},${stdDev})=${formatIndicatorValue(percentBValue)}`);
        }
        return;
      }

      if (indicator.includes('DONCHIAN')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 20);
        const donchian = ensureDonchian(period);
        const middleValue = donchian.middle[decisionIndex];

        conditionLines.push({
          scope,
          left: `DONCHIAN_MIDDLE(${period})`,
          value: formatIndicatorValue(middleValue),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`DONCHIAN_UPPER(${period})`)) {
          indicatorKeys.add(`DONCHIAN_UPPER(${period})`);
          indicatorParts.push(`DONCHIAN_UPPER(${period})=${formatIndicatorValue(donchian.upper[decisionIndex])}`);
        }
        if (!indicatorKeys.has(`DONCHIAN_MIDDLE(${period})`)) {
          indicatorKeys.add(`DONCHIAN_MIDDLE(${period})`);
          indicatorParts.push(`DONCHIAN_MIDDLE(${period})=${formatIndicatorValue(middleValue)}`);
        }
        if (!indicatorKeys.has(`DONCHIAN_LOWER(${period})`)) {
          indicatorKeys.add(`DONCHIAN_LOWER(${period})`);
          indicatorParts.push(`DONCHIAN_LOWER(${period})=${formatIndicatorValue(donchian.lower[decisionIndex])}`);
        }
        return;
      }

      const pattern = resolveCandlePatternName(indicator);
      if (
        pattern &&
        (
          pattern === 'BULLISH_ENGULFING' ||
          pattern === 'BEARISH_ENGULFING' ||
          pattern === 'HAMMER' ||
          pattern === 'SHOOTING_STAR' ||
          pattern === 'DOJI' ||
          pattern === 'MORNING_STAR' ||
          pattern === 'EVENING_STAR' ||
          pattern === 'INSIDE_BAR' ||
          pattern === 'OUTSIDE_BAR'
        )
      ) {
        const patternValues = ensurePattern(indicator, rule.params);
        const value = patternValues ? patternValues[decisionIndex] : null;
        conditionLines.push({
          scope,
          left: pattern,
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(pattern)) {
          indicatorKeys.add(pattern);
          indicatorParts.push(`${pattern}=${formatIndicatorValue(value)}`);
        }
        return;
      }

      if (indicator.includes('MACD')) {
        const fast = clampPeriod(rule.params.fast, 12);
        const slow = clampPeriod(rule.params.slow, 26);
        const signal = clampPeriod(rule.params.signal, 9);
        const macd = ensureMacd(fast, slow, signal);
        const lineValue = macd.line[decisionIndex];
        const signalValue = macd.signal[decisionIndex];
        const histogramValue = macd.histogram[decisionIndex];

        conditionLines.push({
          scope,
          left: `MACD(${fast},${slow},${signal})`,
          value: formatIndicatorValue(lineValue),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });

        if (!indicatorKeys.has(`MACD(${fast},${slow},${signal})`)) {
          indicatorKeys.add(`MACD(${fast},${slow},${signal})`);
          indicatorParts.push(`MACD(${fast},${slow},${signal})=${formatIndicatorValue(lineValue)}`);
        }
        if (!indicatorKeys.has(`MACD_SIGNAL(${fast},${slow},${signal})`)) {
          indicatorKeys.add(`MACD_SIGNAL(${fast},${slow},${signal})`);
          indicatorParts.push(`MACD_SIGNAL(${fast},${slow},${signal})=${formatIndicatorValue(signalValue)}`);
        }
        if (!indicatorKeys.has(`MACD_HIST(${fast},${slow},${signal})`)) {
          indicatorKeys.add(`MACD_HIST(${fast},${slow},${signal})`);
          indicatorParts.push(`MACD_HIST(${fast},${slow},${signal})=${formatIndicatorValue(histogramValue)}`);
        }
        return;
      }

      conditionLines.push({
        scope,
        left: indicator,
        value: 'X',
        operator: rule.condition,
        right: formatRuleTarget(rule.value),
      });
    };

    for (const rule of signalRules.longRules) pushRule('LONG', rule);
    for (const rule of signalRules.shortRules) pushRule('SHORT', rule);

    return {
      direction,
      conditionLines,
      indicatorSummary: indicatorParts.length > 0 ? indicatorParts.join(' | ') : null,
    };
  }
}