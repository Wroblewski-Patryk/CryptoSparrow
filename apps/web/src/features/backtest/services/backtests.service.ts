import axios from "axios";
import api from "../../../lib/api";
import {
  BacktestReport,
  BacktestRun,
  BacktestStatus,
  BacktestTimeline,
  BacktestTimelineQuery,
  BacktestTrade,
  CreateBacktestRunInput,
} from "../types/backtest.type";

export const listBacktestRuns = async (status?: BacktestStatus): Promise<BacktestRun[]> => {
  const res = await api.get<BacktestRun[]>("/dashboard/backtests/runs", {
    params: {
      status,
      limit: 100,
    },
  });
  return res.data;
};

export const createBacktestRun = async (payload: CreateBacktestRunInput): Promise<BacktestRun> => {
  const res = await api.post<BacktestRun>("/dashboard/backtests/runs", payload);
  return res.data;
};

export const deleteBacktestRun = async (runId: string): Promise<void> => {
  await api.delete(`/dashboard/backtests/runs/${runId}`);
};

export const getBacktestRun = async (runId: string): Promise<BacktestRun> => {
  const res = await api.get<BacktestRun>(`/dashboard/backtests/runs/${runId}`);
  return res.data;
};

export const listBacktestRunTrades = async (runId: string): Promise<BacktestTrade[]> => {
  const res = await api.get<BacktestTrade[]>(`/dashboard/backtests/runs/${runId}/trades`, {
    params: {
      limit: 5000,
    },
  });
  return res.data;
};

export const getBacktestRunReport = async (runId: string): Promise<BacktestReport | null> => {
  try {
    const res = await api.get<BacktestReport>(`/dashboard/backtests/runs/${runId}/report`);
    return res.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

export const getBacktestRunTimeline = async (
  runId: string,
  query: BacktestTimelineQuery,
): Promise<BacktestTimeline> => {
  const res = await api.get<BacktestTimeline>(`/dashboard/backtests/runs/${runId}/timeline`, {
    params: {
      symbol: query.symbol,
      cursor: query.cursor ?? 0,
      chunkSize: query.chunkSize ?? 300,
      includeCandles: query.includeCandles ?? true,
      includeIndicators: query.includeIndicators ?? true,
      includeEvents: query.includeEvents ?? true,
    },
  });
  return res.data;
};
