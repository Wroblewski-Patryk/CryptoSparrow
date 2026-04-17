import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBacktestRunCoreData } from "./useBacktestRunCoreData";

const {
  getBacktestRunMock,
  getBacktestRunReportMock,
  listBacktestRunTradesMock,
  getStrategyMock,
  getMarketUniverseMock,
} = vi.hoisted(() => ({
  getBacktestRunMock: vi.fn(),
  getBacktestRunReportMock: vi.fn(),
  listBacktestRunTradesMock: vi.fn(),
  getStrategyMock: vi.fn(),
  getMarketUniverseMock: vi.fn(),
}));

vi.mock("../services/backtests.service", () => ({
  getBacktestRun: getBacktestRunMock,
  getBacktestRunReport: getBacktestRunReportMock,
  listBacktestRunTrades: listBacktestRunTradesMock,
}));

vi.mock("../../strategies/api/strategies.api", () => ({
  getStrategy: getStrategyMock,
}));

vi.mock("../../markets/services/markets.service", () => ({
  getMarketUniverse: getMarketUniverseMock,
}));

describe("useBacktestRunCoreData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("retries transient run bootstrap errors before setting hard error", async () => {
    vi.useFakeTimers();
    const retryRun = {
      id: "run_retry",
      strategyId: null,
      name: "Bootstrap Retry Run",
      symbol: "BTCUSDT",
      timeframe: "1m",
      status: "COMPLETED",
      seedConfig: null,
      startedAt: "2026-04-10T10:00:00.000Z",
      finishedAt: "2026-04-10T10:10:00.000Z",
      notes: null,
      createdAt: "2026-04-10T10:00:00.000Z",
    } as const;
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
      .mockResolvedValue(retryRun);
    getBacktestRunReportMock.mockResolvedValue(null);
    listBacktestRunTradesMock.mockResolvedValue([]);
    getStrategyMock.mockResolvedValue(null);
    getMarketUniverseMock.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useBacktestRunCoreData({
        runId: "run_retry",
        loadErrorDefault: "Nie udalo sie pobrac szczegolow backtestu",
      }),
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();

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
    expect(result.current.run?.id).toBe("run_retry");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("does not re-trigger bootstrap load loop after setting run state", async () => {
    vi.useFakeTimers();
    const runData = {
      id: "run_once",
      strategyId: null,
      name: "Single fetch run",
      symbol: "BTCUSDT",
      timeframe: "1m",
      status: "COMPLETED",
      seedConfig: null,
      startedAt: "2026-04-10T10:00:00.000Z",
      finishedAt: "2026-04-10T10:10:00.000Z",
      notes: null,
      createdAt: "2026-04-10T10:00:00.000Z",
    } as const;
    getBacktestRunMock.mockResolvedValue(runData);
    getBacktestRunReportMock.mockResolvedValue(null);
    listBacktestRunTradesMock.mockResolvedValue([]);
    getStrategyMock.mockResolvedValue(null);
    getMarketUniverseMock.mockResolvedValue(null);

    renderHook(() =>
      useBacktestRunCoreData({
        runId: "run_once",
        loadErrorDefault: "Nie udalo sie pobrac szczegolow backtestu",
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(getBacktestRunMock).toHaveBeenCalledTimes(1);
  });

  it("keeps loaded run data visible when polling refresh fails transiently", async () => {
    vi.useFakeTimers();
    const runningRun = {
      id: "run_polling",
      strategyId: null,
      name: "Polling run",
      symbol: "BTCUSDT",
      timeframe: "1m",
      status: "RUNNING",
      seedConfig: null,
      startedAt: "2026-04-10T10:00:00.000Z",
      finishedAt: null,
      notes: null,
      createdAt: "2026-04-10T10:00:00.000Z",
    } as const;
    getBacktestRunMock
      .mockResolvedValueOnce(runningRun)
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 503,
          data: {
            error: { message: "Service unavailable" },
          },
        },
      });
    getBacktestRunReportMock.mockResolvedValue(null);
    listBacktestRunTradesMock.mockResolvedValue([]);
    getStrategyMock.mockResolvedValue(null);
    getMarketUniverseMock.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useBacktestRunCoreData({
        runId: "run_polling",
        loadErrorDefault: "Nie udalo sie pobrac szczegolow backtestu",
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.run?.id).toBe("run_polling");
    expect(result.current.error).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_100);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(getBacktestRunMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(result.current.run?.id).toBe("run_polling");
    expect(result.current.error).toBeNull();
  });

  it("exposes run-level symbol stats separately from grouped run trades", async () => {
    const runData = {
      id: "run_stats",
      strategyId: null,
      name: "Stats run",
      symbol: "BTCUSDT",
      timeframe: "1m",
      status: "COMPLETED",
      seedConfig: {
        symbols: ["ETHUSDT", "BTCUSDT"],
      },
      startedAt: "2026-04-10T10:00:00.000Z",
      finishedAt: "2026-04-10T10:10:00.000Z",
      notes: null,
      createdAt: "2026-04-10T10:00:00.000Z",
    } as const;
    getBacktestRunMock.mockResolvedValue(runData);
    getBacktestRunReportMock.mockResolvedValue(null);
    listBacktestRunTradesMock.mockResolvedValue([
      {
        id: "trade_1",
        symbol: "BTCUSDT",
        side: "LONG",
        entryPrice: 100,
        exitPrice: 105,
        quantity: 1,
        openedAt: "2026-04-10T10:00:00.000Z",
        closedAt: "2026-04-10T10:05:00.000Z",
        pnl: 5,
        fee: 0.1,
      },
    ]);
    getStrategyMock.mockResolvedValue(null);
    getMarketUniverseMock.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useBacktestRunCoreData({
        runId: "run_stats",
        loadErrorDefault: "Nie udalo sie pobrac szczegolow backtestu",
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.runSymbolStats.map((item) => item.symbol)).toEqual(["BTCUSDT", "ETHUSDT"]);
    expect(result.current.runSymbolStats.find((item) => item.symbol === "BTCUSDT")?.tradesCount).toBe(1);
    expect(result.current.runSymbolStats.find((item) => item.symbol === "ETHUSDT")?.tradesCount).toBe(0);
    expect(result.current.runTradesBySymbol.get("BTCUSDT")).toHaveLength(1);
  });
});
