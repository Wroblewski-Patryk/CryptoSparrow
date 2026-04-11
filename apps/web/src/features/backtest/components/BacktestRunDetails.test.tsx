import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BacktestRunDetails from "./BacktestRunDetails";

const {
  getBacktestRunMock,
  getBacktestRunReportMock,
  getBacktestRunTimelineMock,
  listBacktestRunTradesMock,
  getStrategyMock,
  getMarketUniverseMock,
} = vi.hoisted(() => ({
  getBacktestRunMock: vi.fn(),
  getBacktestRunReportMock: vi.fn(),
  getBacktestRunTimelineMock: vi.fn(),
  listBacktestRunTradesMock: vi.fn(),
  getStrategyMock: vi.fn(),
  getMarketUniverseMock: vi.fn(),
}));

vi.mock("../services/backtests.service", () => ({
  getBacktestRun: getBacktestRunMock,
  getBacktestRunReport: getBacktestRunReportMock,
  getBacktestRunTimeline: getBacktestRunTimelineMock,
  listBacktestRunTrades: listBacktestRunTradesMock,
}));

vi.mock("../../strategies/api/strategies.api", () => ({
  getStrategy: getStrategyMock,
}));

vi.mock("../../markets/services/markets.service", () => ({
  getMarketUniverse: getMarketUniverseMock,
}));

describe("BacktestRunDetails loading UX", () => {
  it("renders skeleton composition while run details are loading", () => {
    getBacktestRunMock.mockReturnValue(new Promise(() => undefined));
    getBacktestRunReportMock.mockResolvedValue(null);
    getBacktestRunTimelineMock.mockResolvedValue(null);
    listBacktestRunTradesMock.mockResolvedValue([]);
    getStrategyMock.mockResolvedValue(null);
    getMarketUniverseMock.mockResolvedValue(null);

    render(<BacktestRunDetails runId="run_01" />);

    expect(screen.getByLabelText("Loading KPI row")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading cards")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading table rows")).toBeInTheDocument();
  });

  it("renders not-found state when run endpoint responds with 404", async () => {
    getBacktestRunMock.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 404,
        data: {
          error: { message: "Not found" },
        },
      },
    });
    getBacktestRunReportMock.mockResolvedValue(null);
    getBacktestRunTimelineMock.mockResolvedValue(null);
    listBacktestRunTradesMock.mockResolvedValue([]);
    getStrategyMock.mockResolvedValue(null);
    getMarketUniverseMock.mockResolvedValue(null);

    render(<BacktestRunDetails runId="missing_run" />);

    expect(await screen.findByText("Nie znaleziono runa")).toBeInTheDocument();
    expect(screen.queryByText("Nie udalo sie pobrac szczegolow backtestu")).not.toBeInTheDocument();
  });

  it("keeps bootstrap loading without flashing hard error on transient fetch failure", async () => {
    vi.useFakeTimers();
    getBacktestRunMock
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 503,
          data: {
            error: { message: "Service unavailable" },
          },
        },
      })
      .mockResolvedValue({
        id: "run_retry",
        strategyId: null,
        name: "Retry run",
        symbol: "BTCUSDT",
        timeframe: "1m",
        status: "COMPLETED",
        seedConfig: null,
        startedAt: "2026-04-10T10:00:00.000Z",
        finishedAt: "2026-04-10T10:10:00.000Z",
        notes: null,
        createdAt: "2026-04-10T10:00:00.000Z",
      });
    getBacktestRunReportMock.mockResolvedValue(null);
    getBacktestRunTimelineMock.mockResolvedValue(null);
    listBacktestRunTradesMock.mockResolvedValue([]);
    getStrategyMock.mockResolvedValue(null);
    getMarketUniverseMock.mockResolvedValue(null);

    render(<BacktestRunDetails runId="run_retry" />);

    expect(screen.queryByText("Nie udalo sie pobrac szczegolow backtestu")).not.toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(getBacktestRunMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("Nie udalo sie pobrac szczegolow backtestu")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
