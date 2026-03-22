export type BacktestStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELED";

export type BacktestRun = {
  id: string;
  strategyId: string | null;
  name: string;
  symbol: string;
  timeframe: string;
  status: BacktestStatus;
  seedConfig?: Record<string, unknown> | null;
  startedAt: string;
  finishedAt: string | null;
  notes: string | null;
  createdAt: string;
};

export type BacktestTrade = {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  openedAt: string;
  closedAt: string;
  pnl: number;
  fee: number | null;
};

export type BacktestReport = {
  id: string;
  backtestRunId: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number | null;
  netPnl: number | null;
  grossProfit: number | null;
  grossLoss: number | null;
  maxDrawdown: number | null;
  sharpe: number | null;
  metrics: {
    initialBalance?: number;
    endBalance?: number;
    [key: string]: unknown;
  } | null;
};

export type CreateBacktestRunInput = {
  name: string;
  symbol?: string;
  timeframe: string;
  strategyId?: string;
  marketUniverseId?: string;
  seedConfig?: Record<string, unknown>;
  notes?: string;
};

export type BacktestTimelineQuery = {
  symbol: string;
  cursor?: number;
  chunkSize?: number;
};

export type BacktestTimelineEvent = {
  id: string;
  tradeId: string;
  type: 'ENTRY' | 'EXIT' | 'DCA' | 'TP' | 'SL';
  side: 'LONG' | 'SHORT';
  timestamp: string;
  price: number;
  pnl: number | null;
  candleIndex: number;
};

export type BacktestTimelineCandle = {
  candleIndex: number;
  openTime: string;
  closeTime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type BacktestTimelineIndicatorPoint = {
  candleIndex: number;
  value: number | null;
};

export type BacktestTimelineIndicatorSeries = {
  key: string;
  name: string;
  period: number;
  panel: 'price' | 'oscillator';
  points: BacktestTimelineIndicatorPoint[];
};

export type BacktestTimeline = {
  runId: string;
  symbol: string;
  timeframe: string;
  marketType: 'SPOT' | 'FUTURES';
  status: BacktestStatus;
  cursor: number;
  nextCursor: number | null;
  totalCandles: number;
  candles: BacktestTimelineCandle[];
  events: BacktestTimelineEvent[];
  indicatorSeries: BacktestTimelineIndicatorSeries[];
  supportedEventTypes: string[];
  unsupportedEventTypes: string[];
  playbackCursor: number | null;
};
