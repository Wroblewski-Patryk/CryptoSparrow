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
  metrics: Record<string, unknown> | null;
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
