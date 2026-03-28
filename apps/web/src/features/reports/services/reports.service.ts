import api from '@/lib/api';

export type CrossModePerformanceMode = "BACKTEST" | "PAPER" | "LIVE";

export type CrossModePerformanceRow = {
  mode: CrossModePerformanceMode;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number | null;
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
};

export type CrossModePerformanceResponse = {
  generatedAt: string;
  modeResolution: "BOT_CURRENT_MODE";
  rows: CrossModePerformanceRow[];
};

export const getCrossModePerformance = async () => {
  const response = await api.get<CrossModePerformanceResponse>("/dashboard/reports/cross-mode-performance");
  return response.data;
};
