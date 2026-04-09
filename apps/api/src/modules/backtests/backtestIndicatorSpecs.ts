import { CandlePatternName, resolveCandlePatternName } from '../engine/sharedCandlePatternSeries';

export type IndicatorSpec = {
  key: string;
  name: string;
  period: number;
  panel: 'price' | 'oscillator';
  source:
    | 'EMA'
    | 'SMA'
    | 'RSI'
    | 'MOMENTUM'
    | 'MACD'
    | 'ROC'
    | 'STOCHRSI'
    | 'STOCHASTIC'
    | 'BOLLINGER'
    | 'ATR'
    | 'CCI'
    | 'DONCHIAN'
    | 'ADX'
    | 'PATTERN'
    | 'FUNDING'
    | 'OPEN_INTEREST'
    | 'ORDER_BOOK';
  params: Record<string, number>;
  patternName?: CandlePatternName;
  channel?:
    | 'LINE'
    | 'SIGNAL'
    | 'HISTOGRAM'
    | 'K'
    | 'D'
    | 'UPPER'
    | 'MIDDLE'
    | 'LOWER'
    | 'BANDWIDTH'
    | 'PERCENT_B'
    | 'ADX'
    | 'DI_PLUS'
    | 'DI_MINUS'
    | 'RAW'
    | 'ZSCORE'
    | 'DELTA'
    | 'MA'
    | 'IMBALANCE'
    | 'SPREAD_BPS'
    | 'DEPTH_RATIO';
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const parseStrategyIndicators = (strategyConfig: unknown): IndicatorSpec[] => {
  if (!strategyConfig || typeof strategyConfig !== 'object') return [];

  const config = strategyConfig as {
    open?: {
      long?: unknown[];
      short?: unknown[];
      indicatorsLong?: unknown[];
      indicatorsShort?: unknown[];
    };
    openConditions?: {
      indicatorsLong?: unknown[];
      indicatorsShort?: unknown[];
    };
  };

  const flatten = [
    ...(config.open?.long ?? []),
    ...(config.open?.short ?? []),
    ...(config.open?.indicatorsLong ?? []),
    ...(config.open?.indicatorsShort ?? []),
    ...(config.openConditions?.indicatorsLong ?? []),
    ...(config.openConditions?.indicatorsShort ?? []),
  ];

  const specs: IndicatorSpec[] = flatten.flatMap((item): IndicatorSpec[] => {
    if (!item || typeof item !== 'object') return [];
    const rawName = (item as { name?: unknown }).name;
    const params = (item as { params?: Record<string, unknown> }).params;
    if (typeof rawName !== 'string') return [];
    const name = rawName.trim().toUpperCase();

    const asPeriod = (value: unknown, fallback: number) => {
      const candidate = Number(value);
      return clamp(Number.isFinite(candidate) ? Math.floor(candidate) : fallback, 2, 300);
    };

    if (name.includes('EMA') && params) {
      const fast = asPeriod(params.fast, 9);
      const slow = asPeriod(params.slow, 21);
      return [
        {
          key: `${name}_FAST_${fast}`,
          name: `${name} FAST`,
          period: fast,
          panel: 'price' as const,
          source: 'EMA' as const,
          params: { period: fast },
        },
        {
          key: `${name}_SLOW_${slow}`,
          name: `${name} SLOW`,
          period: slow,
          panel: 'price' as const,
          source: 'EMA' as const,
          params: { period: slow },
        },
      ];
    }

    if (name.includes('ATR') && params) {
      const period = asPeriod(params.period ?? params.length, 14);
      return [
        {
          key: `${name}_${period}`,
          name: `${name}`,
          period,
          panel: 'oscillator' as const,
          source: 'ATR' as const,
          params: { period },
        },
      ];
    }

    if (name.includes('CCI') && params) {
      const period = asPeriod(params.period ?? params.length, 20);
      return [
        {
          key: `${name}_${period}`,
          name: `${name}`,
          period,
          panel: 'oscillator' as const,
          source: 'CCI' as const,
          params: { period },
        },
      ];
    }

    if (name.includes('DONCHIAN') && params) {
      const period = asPeriod(params.period ?? params.length, 20);
      return [
        {
          key: `${name}_UPPER_${period}`,
          name: `${name} UPPER`,
          period,
          panel: 'price' as const,
          source: 'DONCHIAN' as const,
          params: { period },
          channel: 'UPPER' as const,
        },
        {
          key: `${name}_MIDDLE_${period}`,
          name: `${name} MIDDLE`,
          period,
          panel: 'price' as const,
          source: 'DONCHIAN' as const,
          params: { period },
          channel: 'MIDDLE' as const,
        },
        {
          key: `${name}_LOWER_${period}`,
          name: `${name} LOWER`,
          period,
          panel: 'price' as const,
          source: 'DONCHIAN' as const,
          params: { period },
          channel: 'LOWER' as const,
        },
      ];
    }

    if (name.includes('ADX') && params) {
      const period = asPeriod(params.period ?? params.length, 14);
      return [
        {
          key: `${name}_ADX_${period}`,
          name: `${name} ADX`,
          period: period * 2,
          panel: 'oscillator' as const,
          source: 'ADX' as const,
          params: { period },
          channel: 'ADX' as const,
        },
        {
          key: `${name}_DI_PLUS_${period}`,
          name: `${name} DI+`,
          period,
          panel: 'oscillator' as const,
          source: 'ADX' as const,
          params: { period },
          channel: 'DI_PLUS' as const,
        },
        {
          key: `${name}_DI_MINUS_${period}`,
          name: `${name} DI-`,
          period,
          panel: 'oscillator' as const,
          source: 'ADX' as const,
          params: { period },
          channel: 'DI_MINUS' as const,
        },
      ];
    }

    const pattern = resolveCandlePatternName(name);
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
      const dojiBodyToRangeMaxCandidate = Number(params?.dojiBodyToRangeMax ?? params?.bodyToRangeMax);
      const dojiBodyToRangeMax = Number.isFinite(dojiBodyToRangeMaxCandidate)
        ? dojiBodyToRangeMaxCandidate
        : 0.1;
      return [
        {
          key: pattern === 'DOJI' ? `${name}_${dojiBodyToRangeMax}` : `${name}`,
          name: `${name}`,
          period: 2,
          panel: 'oscillator' as const,
          source: 'PATTERN' as const,
          params: pattern === 'DOJI' ? { dojiBodyToRangeMax } : {},
          patternName: pattern,
        },
      ];
    }

    if (name.includes('STOCHASTIC') && params) {
      const period = asPeriod(params.period ?? params.length, 14);
      const smoothK = asPeriod(params.smoothK, 3);
      const smoothD = asPeriod(params.smoothD, 3);
      const warmup = period + smoothK + smoothD;
      return [
        {
          key: `${name}_K_${period}_${smoothK}_${smoothD}`,
          name: `${name} K`,
          period: warmup,
          panel: 'oscillator' as const,
          source: 'STOCHASTIC' as const,
          params: { period, smoothK, smoothD },
          channel: 'K' as const,
        },
        {
          key: `${name}_D_${period}_${smoothK}_${smoothD}`,
          name: `${name} D`,
          period: warmup,
          panel: 'oscillator' as const,
          source: 'STOCHASTIC' as const,
          params: { period, smoothK, smoothD },
          channel: 'D' as const,
        },
      ];
    }

    if (name.includes('BOLLINGER') && params) {
      const period = asPeriod(params.period, 20);
      const stdDevCandidate = Number(params.stdDev ?? params.deviation);
      const stdDev = Number.isFinite(stdDevCandidate) ? stdDevCandidate : 2;
      return [
        {
          key: `${name}_UPPER_${period}_${stdDev}`,
          name: `${name} UPPER`,
          period,
          panel: 'price' as const,
          source: 'BOLLINGER' as const,
          params: { period, stdDev },
          channel: 'UPPER' as const,
        },
        {
          key: `${name}_MIDDLE_${period}_${stdDev}`,
          name: `${name} MIDDLE`,
          period,
          panel: 'price' as const,
          source: 'BOLLINGER' as const,
          params: { period, stdDev },
          channel: 'MIDDLE' as const,
        },
        {
          key: `${name}_LOWER_${period}_${stdDev}`,
          name: `${name} LOWER`,
          period,
          panel: 'price' as const,
          source: 'BOLLINGER' as const,
          params: { period, stdDev },
          channel: 'LOWER' as const,
        },
        {
          key: `${name}_BANDWIDTH_${period}_${stdDev}`,
          name: `${name} BANDWIDTH`,
          period,
          panel: 'oscillator' as const,
          source: 'BOLLINGER' as const,
          params: { period, stdDev },
          channel: 'BANDWIDTH' as const,
        },
        {
          key: `${name}_PERCENT_B_${period}_${stdDev}`,
          name: `${name} PERCENT_B`,
          period,
          panel: 'oscillator' as const,
          source: 'BOLLINGER' as const,
          params: { period, stdDev },
          channel: 'PERCENT_B' as const,
        },
      ];
    }

    if (name.includes('MACD') && params) {
      const fast = asPeriod(params.fast, 12);
      const slow = asPeriod(params.slow, 26);
      const signal = asPeriod(params.signal, 9);
      const warmup = slow + signal;
      return [
        {
          key: `${name}_LINE_${fast}_${slow}_${signal}`,
          name: `${name} LINE`,
          period: warmup,
          panel: 'oscillator' as const,
          source: 'MACD' as const,
          params: { fast, slow, signal },
          channel: 'LINE' as const,
        },
        {
          key: `${name}_SIGNAL_${fast}_${slow}_${signal}`,
          name: `${name} SIGNAL`,
          period: warmup,
          panel: 'oscillator' as const,
          source: 'MACD' as const,
          params: { fast, slow, signal },
          channel: 'SIGNAL' as const,
        },
        {
          key: `${name}_HISTOGRAM_${fast}_${slow}_${signal}`,
          name: `${name} HISTOGRAM`,
          period: warmup,
          panel: 'oscillator' as const,
          source: 'MACD' as const,
          params: { fast, slow, signal },
          channel: 'HISTOGRAM' as const,
        },
      ];
    }

    if (name.includes('STOCHRSI') && params) {
      const period = asPeriod(params.period ?? params.rsiPeriod, 14);
      const stochPeriod = asPeriod(params.stochPeriod, period);
      const smoothK = asPeriod(params.smoothK, 3);
      const smoothD = asPeriod(params.smoothD, 3);
      const warmup = period + stochPeriod + smoothK + smoothD;
      return [
        {
          key: `${name}_K_${period}_${stochPeriod}_${smoothK}_${smoothD}`,
          name: `${name} K`,
          period: warmup,
          panel: 'oscillator' as const,
          source: 'STOCHRSI' as const,
          params: { period, stochPeriod, smoothK, smoothD },
          channel: 'K' as const,
        },
        {
          key: `${name}_D_${period}_${stochPeriod}_${smoothK}_${smoothD}`,
          name: `${name} D`,
          period: warmup,
          panel: 'oscillator' as const,
          source: 'STOCHRSI' as const,
          params: { period, stochPeriod, smoothK, smoothD },
          channel: 'D' as const,
        },
      ];
    }

    if (name.includes('FUNDING_RATE_ZSCORE')) {
      const zScorePeriod = asPeriod(
        params?.zScorePeriod ?? params?.period ?? params?.length,
        20,
      );
      return [
        {
          key: `${name}_ZSCORE_${zScorePeriod}`,
          name: `${name} ZSCORE`,
          period: zScorePeriod,
          panel: 'oscillator' as const,
          source: 'FUNDING' as const,
          params: { zScorePeriod },
          channel: 'ZSCORE' as const,
        },
      ];
    }

    if (name.includes('FUNDING_RATE')) {
      return [
        {
          key: `${name}_RAW`,
          name: 'FUNDING_RATE',
          period: 2,
          panel: 'oscillator' as const,
          source: 'FUNDING' as const,
          params: { period: 2 },
          channel: 'RAW' as const,
        },
      ];
    }

    if (name.includes('OPEN_INTEREST_ZSCORE')) {
      const zScorePeriod = asPeriod(
        params?.zScorePeriod ?? params?.period ?? params?.length,
        20,
      );
      return [
        {
          key: `${name}_ZSCORE_${zScorePeriod}`,
          name: `${name} ZSCORE`,
          period: zScorePeriod,
          panel: 'oscillator' as const,
          source: 'OPEN_INTEREST' as const,
          params: { zScorePeriod },
          channel: 'ZSCORE' as const,
        },
      ];
    }

    if (name.includes('OPEN_INTEREST_MA')) {
      const period = asPeriod(params?.period ?? params?.length, 20);
      return [
        {
          key: `${name}_MA_${period}`,
          name: `${name} MA`,
          period,
          panel: 'oscillator' as const,
          source: 'OPEN_INTEREST' as const,
          params: { period },
          channel: 'MA' as const,
        },
      ];
    }

    if (name.includes('OPEN_INTEREST_DELTA')) {
      return [
        {
          key: `${name}_DELTA`,
          name: 'OPEN_INTEREST_DELTA',
          period: 2,
          panel: 'oscillator' as const,
          source: 'OPEN_INTEREST' as const,
          params: { period: 2 },
          channel: 'DELTA' as const,
        },
      ];
    }

    if (name.includes('OPEN_INTEREST')) {
      return [
        {
          key: `${name}_RAW`,
          name: 'OPEN_INTEREST',
          period: 2,
          panel: 'oscillator' as const,
          source: 'OPEN_INTEREST' as const,
          params: { period: 2 },
          channel: 'RAW' as const,
        },
      ];
    }

    if (name.includes('ORDER_BOOK_IMBALANCE')) {
      return [
        {
          key: `${name}_IMBALANCE`,
          name: 'ORDER_BOOK_IMBALANCE',
          period: 2,
          panel: 'oscillator' as const,
          source: 'ORDER_BOOK' as const,
          params: { period: 2 },
          channel: 'IMBALANCE' as const,
        },
      ];
    }

    if (name.includes('ORDER_BOOK_SPREAD_BPS')) {
      return [
        {
          key: `${name}_SPREAD_BPS`,
          name: 'ORDER_BOOK_SPREAD_BPS',
          period: 2,
          panel: 'oscillator' as const,
          source: 'ORDER_BOOK' as const,
          params: { period: 2 },
          channel: 'SPREAD_BPS' as const,
        },
      ];
    }

    if (name.includes('ORDER_BOOK_DEPTH_RATIO')) {
      return [
        {
          key: `${name}_DEPTH_RATIO`,
          name: 'ORDER_BOOK_DEPTH_RATIO',
          period: 2,
          panel: 'oscillator' as const,
          source: 'ORDER_BOOK' as const,
          params: { period: 2 },
          channel: 'DEPTH_RATIO' as const,
        },
      ];
    }

    const periodCandidate = params && typeof params.period !== 'undefined'
      ? Number(params.period)
      : params && typeof params.length !== 'undefined'
        ? Number(params.length)
        : 14;
    const period = clamp(Number.isFinite(periodCandidate) ? Math.floor(periodCandidate) : 14, 2, 300);
    const source: IndicatorSpec['source'] = (() => {
      if (name.includes('SMA')) return 'SMA';
      if (name.includes('BOLLINGER')) return 'BOLLINGER';
      if (name.includes('ATR')) return 'ATR';
      if (name.includes('CCI')) return 'CCI';
      if (name.includes('DONCHIAN')) return 'DONCHIAN';
      if (name.includes('ADX')) return 'ADX';
      if (name.includes('FUNDING_RATE')) return 'FUNDING';
      if (name.includes('OPEN_INTEREST')) return 'OPEN_INTEREST';
      if (name.includes('ORDER_BOOK')) return 'ORDER_BOOK';
      if (name.includes('STOCHASTIC')) return 'STOCHASTIC';
      if (name.includes('STOCHRSI')) return 'STOCHRSI';
      if (name.includes('ROC')) return 'ROC';
      if (name.includes('RSI')) return 'RSI';
      if (name.includes('MOMENTUM')) return 'MOMENTUM';
      return 'MOMENTUM';
    })();
    const panel: 'price' | 'oscillator' = source === 'SMA' || source === 'BOLLINGER' ? 'price' : 'oscillator';
    return [{
      key: `${name}_${period}`,
      name,
      period,
      panel,
      source,
      params: { period },
    } satisfies IndicatorSpec];
  });

  const unique = new Map<string, IndicatorSpec>();
  for (const spec of specs) {
    if (!unique.has(spec.key)) unique.set(spec.key, spec);
  }
  return [...unique.values()];
};

export const resolveIndicatorWarmupCandles = (strategyConfig: unknown) => {
  const specs = parseStrategyIndicators(strategyConfig);
  if (specs.length === 0) return 0;
  return specs.reduce((maxPeriod, spec) => Math.max(maxPeriod, spec.period), 0);
};
