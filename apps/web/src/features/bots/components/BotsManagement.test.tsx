import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BotsManagement from "./BotsManagement";

const listMock = vi.hoisted(() => vi.fn());
const createMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());
const getAssistantConfigMock = vi.hoisted(() => vi.fn());
const upsertAssistantConfigMock = vi.hoisted(() => vi.fn());
const upsertSubagentConfigMock = vi.hoisted(() => vi.fn());
const deleteSubagentConfigMock = vi.hoisted(() => vi.fn());
const runAssistantDryRunMock = vi.hoisted(() => vi.fn());
const listRuntimeSessionsMock = vi.hoisted(() => vi.fn());
const getRuntimeSessionMock = vi.hoisted(() => vi.fn());
const listRuntimeSymbolStatsMock = vi.hoisted(() => vi.fn());
const listRuntimePositionsMock = vi.hoisted(() => vi.fn());
const listRuntimeTradesMock = vi.hoisted(() => vi.fn());
const listStrategiesMock = vi.hoisted(() => vi.fn());
const listMarketUniversesMock = vi.hoisted(() => vi.fn());

vi.mock("../services/bots.service", () => ({
  listBots: listMock,
  createBot: createMock,
  updateBot: updateMock,
  deleteBot: deleteMock,
  getBotAssistantConfig: getAssistantConfigMock,
  upsertBotAssistantConfig: upsertAssistantConfigMock,
  upsertBotSubagentConfig: upsertSubagentConfigMock,
  deleteBotSubagentConfig: deleteSubagentConfigMock,
  runBotAssistantDryRun: runAssistantDryRunMock,
  listBotRuntimeSessions: listRuntimeSessionsMock,
  getBotRuntimeSession: getRuntimeSessionMock,
  listBotRuntimeSessionSymbolStats: listRuntimeSymbolStatsMock,
  listBotRuntimeSessionPositions: listRuntimePositionsMock,
  listBotRuntimeSessionTrades: listRuntimeTradesMock,
}));

vi.mock("../../strategies/api/strategies.api", () => ({
  listStrategies: listStrategiesMock,
}));

vi.mock("../../markets/services/markets.service", () => ({
  listMarketUniverses: listMarketUniversesMock,
}));

afterEach(() => {
  vi.restoreAllMocks();
  listStrategiesMock.mockReset();
  listMarketUniversesMock.mockReset();
  getAssistantConfigMock.mockReset();
  upsertAssistantConfigMock.mockReset();
  upsertSubagentConfigMock.mockReset();
  deleteSubagentConfigMock.mockReset();
  runAssistantDryRunMock.mockReset();
  listRuntimeSessionsMock.mockReset();
  getRuntimeSessionMock.mockReset();
  listRuntimeSymbolStatsMock.mockReset();
  listRuntimePositionsMock.mockReset();
  listRuntimeTradesMock.mockReset();
});

describe("BotsManagement", () => {
  it("shows and hides paper start balance based on selected bot mode", async () => {
    listMock.mockResolvedValue([]);
    listStrategiesMock.mockResolvedValue([{ id: "s-mode", name: "Mode Strategy", interval: "5m" }]);
    listMarketUniversesMock.mockResolvedValue([
      { id: "g-mode", name: "Mode Group", marketType: "FUTURES", baseCurrency: "USDT", whitelist: [], blacklist: [] },
    ]);

    render(<BotsManagement />);
    await waitFor(() => {
      expect(screen.getByLabelText("Tryb bota")).toHaveValue("PAPER");
      expect(screen.getByLabelText("Paper start balance")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Tryb bota"), {
      target: { value: "LIVE" },
    });
    expect(screen.queryByLabelText("Paper start balance")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Tryb bota"), {
      target: { value: "PAPER" },
    });
    expect(screen.getByLabelText("Paper start balance")).toBeInTheDocument();
  });

  it("renders strategy-derived summary values for selected strategy", async () => {
    listMock.mockResolvedValue([]);
    listStrategiesMock.mockResolvedValue([
      {
        id: "s-one",
        name: "One",
        interval: "5m",
        leverage: 12,
        config: { additional: { maxPositions: 3 } },
      },
      {
        id: "s-two",
        name: "Two",
        interval: "15m",
        leverage: 7,
        config: { additional: { maxOpenPositions: 5 } },
      },
    ]);
    listMarketUniversesMock.mockResolvedValue([
      { id: "g-summary", name: "Summary Group", marketType: "FUTURES", baseCurrency: "USDT", whitelist: [], blacklist: [] },
    ]);

    render(<BotsManagement />);
    await waitFor(() => {
      expect(screen.getByLabelText("Strategia bota")).toHaveValue("s-one");
    });

    expect(screen.getByText("3. Kontekst strategii")).toBeInTheDocument();
    expect(screen.getByText("5m")).toBeInTheDocument();
    expect(screen.getByText("12x")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Strategia bota"), {
      target: { value: "s-two" },
    });

    expect(screen.getByText("15m")).toBeInTheDocument();
    expect(screen.getByText("7x")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("requires confirmation before creating LIVE bot", async () => {
    listMock.mockResolvedValue([]);
    listStrategiesMock.mockResolvedValue([{ id: "s-live", name: "Live Strategy", interval: "5m" }]);
    listMarketUniversesMock.mockResolvedValue([
      { id: "g-live", name: "Live Group", marketType: "FUTURES", baseCurrency: "USDT", whitelist: [], blacklist: [] },
    ]);
    createMock.mockResolvedValue({
      id: "b-live",
      name: "Live Runner",
      mode: "LIVE",
      paperStartBalance: 10000,
      marketType: "FUTURES",
      positionMode: "ONE_WAY",
      isActive: false,
      liveOptIn: false,
      maxOpenPositions: 1,
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<BotsManagement />);
    await waitFor(() => {
      expect(listMarketUniversesMock).toHaveBeenCalled();
      expect(screen.getByLabelText("Strategia")).toHaveValue("s-live");
    });

    fireEvent.change(screen.getByPlaceholderText("Momentum Runner"), {
      target: { value: "Live Runner" },
    });
    fireEvent.change(screen.getByLabelText("Tryb bota"), {
      target: { value: "LIVE" },
    });
    expect(screen.queryByLabelText("Paper start balance")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dodaj bota" }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });
    expect(createMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("renders empty state when no bots returned", async () => {
    listMock.mockResolvedValue([]);
    listStrategiesMock.mockResolvedValue([]);
    listMarketUniversesMock.mockResolvedValue([]);

    render(<BotsManagement />);

    await waitFor(() => {
      expect(screen.getByText("Brak botow")).toBeInTheDocument();
    });
  });

  it("creates bot from form fields", async () => {
    listMock.mockResolvedValue([]);
    listStrategiesMock.mockResolvedValue([{ id: "s1", name: "Momentum Strategy", interval: "5m" }]);
    listMarketUniversesMock.mockResolvedValue([
      { id: "g1", name: "Core Group", marketType: "FUTURES", baseCurrency: "USDT", whitelist: [], blacklist: [] },
    ]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    createMock.mockResolvedValue({
      id: "b1",
      name: "Momentum Runner",
      mode: "PAPER",
      paperStartBalance: 10000,
      marketType: "FUTURES",
      positionMode: "ONE_WAY",
      isActive: false,
      liveOptIn: false,
      maxOpenPositions: 3,
    });

    render(<BotsManagement />);
    await waitFor(() => {
      expect(listMarketUniversesMock).toHaveBeenCalled();
      expect(screen.getByLabelText("Strategia")).toHaveValue("s1");
    });

    fireEvent.change(screen.getByPlaceholderText("Momentum Runner"), {
      target: { value: "Momentum Runner" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Dodaj bota" }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({
        name: "Momentum Runner",
        mode: "PAPER",
        paperStartBalance: 10000,
        strategyId: "s1",
        marketGroupId: "g1",
        isActive: true,
        liveOptIn: false,
        consentTextVersion: null,
      });
    });
  });

  it("filters bots by market type", async () => {
    listStrategiesMock.mockResolvedValue([{ id: "s-filter", name: "Filter Strategy", interval: "5m" }]);
    listMarketUniversesMock.mockResolvedValue([
      { id: "g-filter", name: "Filter Group", marketType: "FUTURES", baseCurrency: "USDT", whitelist: [], blacklist: [] },
    ]);
    listMock
      .mockResolvedValueOnce([
        {
          id: "b-futures",
          name: "Futures Bot",
          mode: "PAPER",
          paperStartBalance: 10000,
          marketType: "FUTURES",
          positionMode: "ONE_WAY",
          isActive: false,
          liveOptIn: false,
          maxOpenPositions: 1,
        },
        {
          id: "b-spot",
          name: "Spot Bot",
          mode: "PAPER",
          paperStartBalance: 10000,
          marketType: "SPOT",
          positionMode: "ONE_WAY",
          isActive: false,
          liveOptIn: false,
          maxOpenPositions: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "b-spot",
          name: "Spot Bot",
          mode: "PAPER",
          paperStartBalance: 10000,
          marketType: "SPOT",
          positionMode: "ONE_WAY",
          isActive: false,
          liveOptIn: false,
          maxOpenPositions: 1,
        },
      ]);

    render(<BotsManagement />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Futures Bot")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Spot Bot")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Filtr rynku botow"), {
      target: { value: "SPOT" },
    });

    await waitFor(() => {
      expect(listMock).toHaveBeenLastCalledWith("SPOT");
      expect(screen.queryByDisplayValue("Futures Bot")).not.toBeInTheDocument();
      expect(screen.getByDisplayValue("Spot Bot")).toBeInTheDocument();
    });
  });

  it("requires confirmation before deleting active LIVE bot", async () => {
    listStrategiesMock.mockResolvedValue([{ id: "s-delete", name: "Delete Strategy", interval: "5m" }]);
    listMarketUniversesMock.mockResolvedValue([
      { id: "g-delete", name: "Delete Group", marketType: "FUTURES", baseCurrency: "USDT", whitelist: [], blacklist: [] },
    ]);
    listMock.mockResolvedValue([
      {
        id: "b-live",
        name: "Live Bot",
        mode: "LIVE",
        paperStartBalance: 10000,
        marketType: "FUTURES",
        positionMode: "HEDGE",
        isActive: true,
        liveOptIn: true,
        maxOpenPositions: 1,
      },
    ]);
    deleteMock.mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<BotsManagement />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Live Bot")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Usun" }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("renders monitoring tab with runtime session summary, symbol stats and trades", async () => {
    listStrategiesMock.mockResolvedValue([{ id: "s-monitor", name: "Monitor Strategy", interval: "5m" }]);
    listMarketUniversesMock.mockResolvedValue([
      {
        id: "g-monitor",
        name: "Monitor Group",
        marketType: "FUTURES",
        baseCurrency: "USDT",
        whitelist: [],
        blacklist: [],
      },
    ]);
    listMock.mockResolvedValue([
      {
        id: "b-monitor",
        name: "Monitor Bot",
        mode: "PAPER",
        paperStartBalance: 10000,
        marketType: "FUTURES",
        positionMode: "ONE_WAY",
        isActive: true,
        liveOptIn: false,
        maxOpenPositions: 1,
      },
    ]);

    listRuntimeSessionsMock.mockResolvedValue([
      {
        id: "session-1",
        botId: "b-monitor",
        mode: "PAPER",
        status: "RUNNING",
        startedAt: "2026-03-31T10:00:00.000Z",
        finishedAt: null,
        lastHeartbeatAt: "2026-03-31T10:05:00.000Z",
        stopReason: null,
        errorMessage: null,
        createdAt: "2026-03-31T10:00:00.000Z",
        updatedAt: "2026-03-31T10:05:00.000Z",
        durationMs: 300000,
        eventsCount: 12,
        symbolsTracked: 2,
        summary: {
          totalSignals: 8,
          dcaCount: 1,
          closedTrades: 3,
          realizedPnl: 120.5,
        },
      },
    ]);

    getRuntimeSessionMock.mockResolvedValue({
      id: "session-1",
      botId: "b-monitor",
      mode: "PAPER",
      status: "RUNNING",
      startedAt: "2026-03-31T10:00:00.000Z",
      finishedAt: null,
      lastHeartbeatAt: "2026-03-31T10:05:00.000Z",
      stopReason: null,
      errorMessage: null,
      metadata: null,
      createdAt: "2026-03-31T10:00:00.000Z",
      updatedAt: "2026-03-31T10:05:00.000Z",
      durationMs: 300000,
      eventsCount: 12,
      symbolsTracked: 2,
      summary: {
        totalSignals: 8,
        longEntries: 3,
        shortEntries: 1,
        exits: 2,
        dcaCount: 1,
        closedTrades: 3,
        winningTrades: 2,
        losingTrades: 1,
        realizedPnl: 120.5,
        grossProfit: 150,
        grossLoss: -29.5,
        feesPaid: 8.2,
      },
    });

    listRuntimeSymbolStatsMock.mockResolvedValue({
      sessionId: "session-1",
      items: [
        {
          id: "stat-1",
          userId: "u1",
          botId: "b-monitor",
          sessionId: "session-1",
          symbol: "BTCUSDT",
          totalSignals: 5,
          longEntries: 2,
          shortEntries: 1,
          exits: 1,
          dcaCount: 1,
          closedTrades: 2,
          winningTrades: 2,
          losingTrades: 0,
          realizedPnl: 90,
          grossProfit: 100,
          grossLoss: -10,
          feesPaid: 4,
          openPositionCount: 0,
          openPositionQty: 0,
          lastPrice: 72000,
          lastSignalAt: "2026-03-31T10:03:00.000Z",
          lastTradeAt: "2026-03-31T10:04:00.000Z",
          snapshotAt: "2026-03-31T10:05:00.000Z",
          createdAt: "2026-03-31T10:00:00.000Z",
          updatedAt: "2026-03-31T10:05:00.000Z",
        },
      ],
      summary: {
        totalSignals: 5,
        longEntries: 2,
        shortEntries: 1,
        exits: 1,
        dcaCount: 1,
        closedTrades: 2,
        winningTrades: 2,
        losingTrades: 0,
        realizedPnl: 90,
        grossProfit: 100,
        grossLoss: -10,
        feesPaid: 4,
      },
    });

    listRuntimePositionsMock.mockResolvedValue({
      sessionId: "session-1",
      total: 1,
      openCount: 1,
      closedCount: 0,
      openOrdersCount: 0,
      window: {
        startedAt: "2026-03-31T10:00:00.000Z",
        finishedAt: "2026-03-31T10:05:00.000Z",
      },
      summary: {
        realizedPnl: 0,
        unrealizedPnl: 15,
        feesPaid: 0.7,
      },
      openOrders: [],
      openItems: [
        {
          id: "p1",
          symbol: "BTCUSDT",
          side: "LONG",
          status: "OPEN",
          quantity: 0.01,
          leverage: 1,
          entryPrice: 70000,
          entryNotional: 700,
          exitPrice: null,
          stopLoss: null,
          takeProfit: null,
          openedAt: "2026-03-31T10:04:00.000Z",
          closedAt: null,
          holdMs: 60000,
          dcaCount: 0,
          feesPaid: 0.7,
          realizedPnl: 0,
          unrealizedPnl: 15,
          markPrice: 71500,
          firstTradeAt: "2026-03-31T10:04:30.000Z",
          lastTradeAt: "2026-03-31T10:04:30.000Z",
          tradesCount: 1,
        },
      ],
      historyItems: [],
    });

    listRuntimeTradesMock.mockResolvedValue({
      sessionId: "session-1",
      total: 1,
      window: {
        startedAt: "2026-03-31T10:00:00.000Z",
        finishedAt: "2026-03-31T10:05:00.000Z",
      },
      items: [
        {
          id: "trade-1",
          symbol: "BTCUSDT",
          side: "BUY",
          price: 70000,
          quantity: 0.01,
          fee: 0.7,
          realizedPnl: 30,
          executedAt: "2026-03-31T10:04:30.000Z",
          orderId: "o1",
          positionId: "p1",
          strategyId: "s-monitor",
          origin: "BOT",
          managementMode: "BOT",
          notional: 700,
        },
      ],
    });

    render(<BotsManagement />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Monitor Bot")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Monitoring" }));

    await waitFor(() => {
      expect(listRuntimeSessionsMock).toHaveBeenCalledWith("b-monitor", { status: undefined, limit: 50 });
    });

    await waitFor(() => {
      expect(listRuntimeSymbolStatsMock).toHaveBeenCalledWith("b-monitor", "session-1", {
        symbol: undefined,
        limit: 200,
      });
      expect(screen.getByText("Co bedzie - live check sygnalow")).toBeInTheDocument();
      expect(screen.getAllByText("BTCUSDT").length).toBeGreaterThan(0);
      expect(screen.getByText("Historia - log operacyjny trade'ow")).toBeInTheDocument();
    });
  });

  it("enables monitoring auto-refresh interval for RUNNING sessions", async () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    listStrategiesMock.mockResolvedValue([{ id: "s-refresh", name: "Refresh Strategy", interval: "5m" }]);
    listMarketUniversesMock.mockResolvedValue([
      {
        id: "g-refresh",
        name: "Refresh Group",
        marketType: "FUTURES",
        baseCurrency: "USDT",
        whitelist: [],
        blacklist: [],
      },
    ]);
    listMock.mockResolvedValue([
      {
        id: "b-refresh",
        name: "Refresh Bot",
        mode: "PAPER",
        paperStartBalance: 10000,
        marketType: "FUTURES",
        positionMode: "ONE_WAY",
        isActive: true,
        liveOptIn: false,
        maxOpenPositions: 1,
      },
    ]);

    listRuntimeSessionsMock.mockResolvedValue([
      {
        id: "session-refresh",
        botId: "b-refresh",
        mode: "PAPER",
        status: "RUNNING",
        startedAt: "2026-03-31T10:00:00.000Z",
        finishedAt: null,
        lastHeartbeatAt: "2026-03-31T10:05:00.000Z",
        stopReason: null,
        errorMessage: null,
        createdAt: "2026-03-31T10:00:00.000Z",
        updatedAt: "2026-03-31T10:05:00.000Z",
        durationMs: 300000,
        eventsCount: 1,
        symbolsTracked: 1,
        summary: {
          totalSignals: 1,
          dcaCount: 0,
          closedTrades: 0,
          realizedPnl: 0,
        },
      },
    ]);

    getRuntimeSessionMock.mockResolvedValue({
      id: "session-refresh",
      botId: "b-refresh",
      mode: "PAPER",
      status: "RUNNING",
      startedAt: "2026-03-31T10:00:00.000Z",
      finishedAt: null,
      lastHeartbeatAt: "2026-03-31T10:05:00.000Z",
      stopReason: null,
      errorMessage: null,
      metadata: null,
      createdAt: "2026-03-31T10:00:00.000Z",
      updatedAt: "2026-03-31T10:05:00.000Z",
      durationMs: 300000,
      eventsCount: 1,
      symbolsTracked: 1,
      summary: {
        totalSignals: 1,
        longEntries: 1,
        shortEntries: 0,
        exits: 0,
        dcaCount: 0,
        closedTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        realizedPnl: 0,
        grossProfit: 0,
        grossLoss: 0,
        feesPaid: 0,
      },
    });

    listRuntimeSymbolStatsMock.mockResolvedValue({
      sessionId: "session-refresh",
      items: [],
      summary: {
        totalSignals: 0,
        longEntries: 0,
        shortEntries: 0,
        exits: 0,
        dcaCount: 0,
        closedTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        realizedPnl: 0,
        grossProfit: 0,
        grossLoss: 0,
        feesPaid: 0,
      },
    });

    listRuntimePositionsMock.mockResolvedValue({
      sessionId: "session-refresh",
      total: 0,
      openCount: 0,
      closedCount: 0,
      openOrdersCount: 0,
      window: {
        startedAt: "2026-03-31T10:00:00.000Z",
        finishedAt: "2026-03-31T10:05:00.000Z",
      },
      summary: {
        realizedPnl: 0,
        unrealizedPnl: 0,
        feesPaid: 0,
      },
      openOrders: [],
      openItems: [],
      historyItems: [],
    });

    listRuntimeTradesMock.mockResolvedValue({
      sessionId: "session-refresh",
      total: 0,
      window: {
        startedAt: "2026-03-31T10:00:00.000Z",
        finishedAt: "2026-03-31T10:05:00.000Z",
      },
      items: [],
    });

    render(<BotsManagement />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Refresh Bot")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Monitoring" }));

    await waitFor(() => {
      expect(listRuntimeSessionsMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 15000);
    });

    setIntervalSpy.mockRestore();
  });
});
