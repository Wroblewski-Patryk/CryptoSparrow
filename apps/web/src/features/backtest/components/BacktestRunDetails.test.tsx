import { render, screen } from "@testing-library/react";
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
});
