import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PerformanceReportsView from "./PerformanceReportsView";

const listRunsMock = vi.hoisted(() => vi.fn());
const getReportMock = vi.hoisted(() => vi.fn());

vi.mock("../../backtest/services/backtests.service", () => ({
  listBacktestRuns: listRunsMock,
  getBacktestRunReport: getReportMock,
}));

describe("PerformanceReportsView", () => {
  it("renders empty state when there are no completed runs", async () => {
    listRunsMock.mockResolvedValue([]);
    getReportMock.mockResolvedValue(null);

    render(<PerformanceReportsView />);

    await waitFor(() => {
      expect(screen.getByText("Brak raportow performance")).toBeInTheDocument();
    });
  });

  it("renders aggregated metrics and rows when reports exist", async () => {
    listRunsMock.mockResolvedValue([
      {
        id: "r1",
        strategyId: null,
        name: "Run Alpha",
        symbol: "BTCUSDT",
        timeframe: "5m",
        status: "COMPLETED",
        startedAt: "2026-03-16T10:00:00.000Z",
        finishedAt: "2026-03-16T11:00:00.000Z",
        notes: null,
        createdAt: "2026-03-16T10:00:00.000Z",
      },
    ]);
    getReportMock.mockResolvedValue({
      id: "rep1",
      backtestRunId: "r1",
      totalTrades: 12,
      winningTrades: 8,
      losingTrades: 4,
      winRate: 66.7,
      netPnl: 245.5,
      grossProfit: 300,
      grossLoss: -54.5,
      maxDrawdown: 12.2,
      sharpe: 1.4,
      metrics: null,
    });

    render(<PerformanceReportsView />);

    await waitFor(() => {
      expect(screen.getByText("Reports performance loaded")).toBeInTheDocument();
      expect(screen.getByText("Performance by backtest run")).toBeInTheDocument();
      expect(screen.getByText("BTCUSDT")).toBeInTheDocument();
      expect(screen.getAllByText("Run Alpha").length).toBeGreaterThan(0);
    });
  });
});
