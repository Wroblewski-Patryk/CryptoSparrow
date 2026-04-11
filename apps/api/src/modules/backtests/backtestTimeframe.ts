export const timeframeIntervalMs: Record<string, number> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '2h': 7_200_000,
  '4h': 14_400_000,
  '6h': 21_600_000,
  '8h': 28_800_000,
  '12h': 43_200_000,
  '1d': 86_400_000,
};

const timeframeDefaultCandles: Record<string, number> = {
  '1m': 2000,
  '3m': 1800,
  '5m': 1600,
  '15m': 1200,
  '30m': 900,
  '1h': 700,
  '2h': 500,
  '4h': 350,
  '6h': 250,
  '8h': 200,
  '12h': 150,
  '1d': 60,
};

export const normalizeTimeframe = (value: string) => {
  const raw = value.trim().toLowerCase();
  const aliases: Record<string, string> = {
    '1 min': '1m',
    '3 min': '3m',
    '5 min': '5m',
    '10 min': '10m',
    '15 min': '15m',
    '30 min': '30m',
    '60 min': '1h',
  };

  return aliases[raw] ?? raw;
};

export const getTimeframeIntervalMs = (timeframe: string) =>
  timeframeIntervalMs[normalizeTimeframe(timeframe)] ?? timeframeIntervalMs['5m'];

export const getDefaultCandlesForTimeframe = (timeframe: string) =>
  timeframeDefaultCandles[normalizeTimeframe(timeframe)] ?? 1000;
