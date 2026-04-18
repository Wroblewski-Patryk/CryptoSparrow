import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BacktestsList } from "./BacktestsList";

const listRunsMock = vi.hoisted(() => vi.fn());
const createRunMock = vi.hoisted(() => vi.fn());
const listTradesMock = vi.hoisted(() => vi.fn());
const getReportMock = vi.hoisted(() => vi.fn());
const listStrategiesMock = vi.hoisted(() => vi.fn());

vi.mock("../services/backtests.service", () => ({
  listBacktestRuns: listRunsMock,
  createBacktestRun: createRunMock,
  listBacktestRunTrades: listTradesMock,
  getBacktestRunReport: getReportMock,
}));

vi.mock("../../strategies/api/strategies.api", () => ({
  listStrategies: listStrategiesMock,
}));

describe("BacktestsList", () => {
  it("renders empty state when no runs are returned", async () => {
    listRunsMock.mockResolvedValue([]);
    listStrategiesMock.mockResolvedValue([]);
    listTradesMock.mockResolvedValue([]);
    getReportMock.mockResolvedValue(null);

    render(<BacktestsList />);

    await waitFor(() => {
      expect(screen.getByText("No backtest runs")).toBeInTheDocument();
    });
  });

  it("renders summary and trades for selected run", async () => {
    listRunsMock.mockResolvedValue([
      {
        id: "r1",
        strategyId: null,
        name: "Run A",
        symbol: "BTCUSDT",
        timeframe: "5m",
        status: "COMPLETED",
        startedAt: "2026-03-16T10:00:00.000Z",
        finishedAt: "2026-03-16T10:30:00.000Z",
        notes: null,
        createdAt: "2026-03-16T10:00:00.000Z",
      },
    ]);
    listStrategiesMock.mockResolvedValue([]);
    listTradesMock.mockResolvedValue([
      {
        id: "t1",
        symbol: "BTCUSDT",
        side: "LONG",
        entryPrice: 62000,
        exitPrice: 62500,
        quantity: 0.1,
        openedAt: "2026-03-16T10:01:00.000Z",
        closedAt: "2026-03-16T10:03:00.000Z",
        pnl: 50,
        fee: 1,
      },
    ]);
    getReportMock.mockResolvedValue({
      id: "rep1",
      backtestRunId: "r1",
      totalTrades: 1,
      winningTrades: 1,
      losingTrades: 0,
      winRate: 100,
      netPnl: 50,
      grossProfit: 50,
      grossLoss: 0,
      maxDrawdown: 0,
      sharpe: 1.2,
      metrics: null,
    });

    render(<BacktestsList />);

    await waitFor(() => {
      expect(screen.getByText("Run A")).toBeInTheDocument();
      expect(screen.getByText("Net PnL")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Trades" }));
    await waitFor(() => {
      expect(screen.getByText("LONG")).toBeInTheDocument();
    });
  });
});
