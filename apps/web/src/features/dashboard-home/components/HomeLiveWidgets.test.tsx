import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../../i18n/I18nProvider";
import HomeLiveWidgets from "./HomeLiveWidgets";

const listBotsMock = vi.hoisted(() => vi.fn());
const listBotRuntimeSessionsMock = vi.hoisted(() => vi.fn());
const listBotRuntimeSessionSymbolStatsMock = vi.hoisted(() => vi.fn());
const listBotRuntimeSessionPositionsMock = vi.hoisted(() => vi.fn());
const listBotRuntimeSessionTradesMock = vi.hoisted(() => vi.fn());

vi.mock("../../../features/bots/services/bots.service", () => ({
  listBots: listBotsMock,
  listBotRuntimeSessions: listBotRuntimeSessionsMock,
  listBotRuntimeSessionSymbolStats: listBotRuntimeSessionSymbolStatsMock,
  listBotRuntimeSessionPositions: listBotRuntimeSessionPositionsMock,
  listBotRuntimeSessionTrades: listBotRuntimeSessionTradesMock,
}));

describe("HomeLiveWidgets", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const renderSubject = () => {
    window.localStorage.setItem("cryptosparrow-locale", "pl");
    return render(
      <I18nProvider>
        <HomeLiveWidgets />
      </I18nProvider>
    );
  };

  it("renders empty state when there are no bots", async () => {
    listBotsMock.mockResolvedValue([]);
    listBotRuntimeSessionsMock.mockResolvedValue([]);
    listBotRuntimeSessionSymbolStatsMock.mockResolvedValue({
      sessionId: "none",
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
        unrealizedPnl: 0,
        grossProfit: 0,
        grossLoss: 0,
        feesPaid: 0,
      },
    });
    listBotRuntimeSessionPositionsMock.mockResolvedValue({
      sessionId: "none",
      total: 0,
      openCount: 0,
      closedCount: 0,
      openOrdersCount: 0,
      window: {
        startedAt: "2026-03-31T10:00:00.000Z",
        finishedAt: "2026-03-31T10:00:00.000Z",
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
    listBotRuntimeSessionTradesMock.mockResolvedValue({
      sessionId: "none",
      total: 0,
      meta: {
        page: 1,
        pageSize: 25,
        total: 0,
        totalPages: 0,
        hasPrev: false,
        hasNext: false,
      },
      window: {
        startedAt: "2026-03-31T10:00:00.000Z",
        finishedAt: "2026-03-31T10:00:00.000Z",
      },
      items: [],
    });

    renderSubject();

    await waitFor(() => {
      expect(screen.getByText("Brak botow do podsumowania dashboardu")).toBeInTheDocument();
      expect(screen.getByText("Dodaj bota")).toBeInTheDocument();
    });
  });

  it("renders runtime summary, monitored bots and market signals", async () => {
    listBotsMock.mockResolvedValue([
      {
        id: "bot-1",
        name: "Monitor Bot",
        mode: "PAPER",
        paperStartBalance: 10000,
        marketType: "FUTURES",
        positionMode: "ONE_WAY",
        strategyId: "str-1",
        isActive: true,
        liveOptIn: false,
        maxOpenPositions: 2,
      },
    ]);

    listBotRuntimeSessionsMock.mockResolvedValue([
      {
        id: "session-1",
        botId: "bot-1",
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
        eventsCount: 16,
        symbolsTracked: 2,
        summary: {
          totalSignals: 14,
          dcaCount: 1,
          closedTrades: 5,
          realizedPnl: 230.5,
        },
      },
    ]);

    listBotRuntimeSessionSymbolStatsMock.mockResolvedValue({
      sessionId: "session-1",
      items: [
        {
          id: "stat-1",
          userId: "u-1",
          botId: "bot-1",
          sessionId: "session-1",
          symbol: "BTCUSDT",
          totalSignals: 9,
          longEntries: 4,
          shortEntries: 3,
          exits: 2,
          dcaCount: 1,
          closedTrades: 4,
          winningTrades: 3,
          losingTrades: 1,
          realizedPnl: 180,
          grossProfit: 240,
          grossLoss: -60,
          feesPaid: 12,
          openPositionCount: 1,
          openPositionQty: 0.12,
          unrealizedPnl: 35,
          lastPrice: 68000,
          lastSignalAt: "2026-03-31T10:04:00.000Z",
          lastSignalDirection: "LONG",
          lastSignalDecisionAt: "2026-03-31T10:04:00.000Z",
          lastTradeAt: "2026-03-31T10:03:00.000Z",
          snapshotAt: "2026-03-31T10:05:00.000Z",
          createdAt: "2026-03-31T10:05:00.000Z",
          updatedAt: "2026-03-31T10:05:00.000Z",
        },
      ],
      summary: {
        totalSignals: 9,
        longEntries: 4,
        shortEntries: 3,
        exits: 2,
        dcaCount: 1,
        closedTrades: 4,
        winningTrades: 3,
        losingTrades: 1,
        realizedPnl: 180,
        unrealizedPnl: 35,
        totalPnl: 215,
        grossProfit: 240,
        grossLoss: -60,
        feesPaid: 12,
      },
    });
    listBotRuntimeSessionPositionsMock.mockResolvedValue({
      sessionId: "session-1",
      total: 2,
      openCount: 2,
      closedCount: 0,
      openOrdersCount: 0,
      showDynamicStopColumns: true,
      window: {
        startedAt: "2026-03-31T10:00:00.000Z",
        finishedAt: "2026-03-31T10:05:00.000Z",
      },
      summary: {
        realizedPnl: 0,
        unrealizedPnl: 35,
        feesPaid: 0,
      },
      openOrders: [],
      openItems: [
        {
          id: "pos-1",
          symbol: "BTCUSDT",
          side: "LONG",
          status: "OPEN",
          quantity: 0.12,
          leverage: 15,
          entryPrice: 68000,
          entryNotional: 8160,
          exitPrice: null,
          stopLoss: null,
          takeProfit: null,
          openedAt: "2026-03-31T10:03:00.000Z",
          closedAt: null,
          holdMs: 120000,
          dcaCount: 2,
          dcaPlannedLevels: [-15, -30, -45],
          dcaExecutedLevels: [-15, -30],
          feesPaid: 0,
          realizedPnl: 0,
          unrealizedPnl: 35,
          markPrice: 68290,
          dynamicTtpStopLoss: null,
          dynamicTslStopLoss: null,
          firstTradeAt: "2026-03-31T10:03:00.000Z",
          lastTradeAt: "2026-03-31T10:04:00.000Z",
          tradesCount: 1,
        },
        {
          id: "pos-2",
          symbol: "ETHUSDT",
          side: "LONG",
          status: "OPEN",
          quantity: 0.5,
          leverage: 15,
          entryPrice: 2500,
          entryNotional: 1250,
          exitPrice: null,
          stopLoss: null,
          takeProfit: null,
          openedAt: "2026-03-31T10:02:00.000Z",
          closedAt: null,
          holdMs: 180000,
          dcaCount: 0,
          dcaPlannedLevels: [],
          dcaExecutedLevels: [],
          feesPaid: 0,
          realizedPnl: 0,
          unrealizedPnl: 12,
          markPrice: 2520,
          dynamicTtpStopLoss: 2508.4321,
          dynamicTslStopLoss: 2496.5555,
          firstTradeAt: "2026-03-31T10:02:00.000Z",
          lastTradeAt: "2026-03-31T10:04:00.000Z",
          tradesCount: 1,
        },
      ],
      historyItems: [],
    });
    listBotRuntimeSessionTradesMock.mockResolvedValue({
      sessionId: "session-1",
      total: 1,
      meta: {
        page: 1,
        pageSize: 25,
        total: 1,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
      },
      window: {
        startedAt: "2026-03-31T10:00:00.000Z",
        finishedAt: "2026-03-31T10:05:00.000Z",
      },
      items: [
        {
          id: "trade-1",
          symbol: "BTCUSDT",
          side: "BUY",
          lifecycleAction: "OPEN",
          price: 68000,
          quantity: 0.12,
          fee: 0,
          feeSource: "ESTIMATED",
          feePending: false,
          feeCurrency: "USDT",
          realizedPnl: 0,
          executedAt: "2026-03-31T10:03:00.000Z",
          orderId: "ord-1",
          positionId: "pos-1",
          strategyId: "str-1",
          origin: "BOT",
          managementMode: "SIGNAL",
          notional: 8160,
          margin: 544,
        },
      ],
    });

    renderSubject();

    await waitFor(() => {
      expect(screen.getByText("Otwarte pozycje")).toBeInTheDocument();
      expect(screen.getByText("Bot runtime i ryzyko")).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /Monitor Bot/i })).toBeInTheDocument();
      expect(screen.getAllByText("RUNNING").length).toBeGreaterThan(0);
      expect(screen.getAllByText("BTCUSDT").length).toBeGreaterThan(0);
      expect(screen.getByText("2 (1:-15%, 2:-30%)")).toBeInTheDocument();
      expect(screen.getByText("TTP")).toBeInTheDocument();
      expect(screen.getByText("TSL")).toBeInTheDocument();
      expect(screen.getByText("2508,4321")).toBeInTheDocument();
      expect(screen.getByText("2496,5555")).toBeInTheDocument();
      expect(screen.getAllByText("-").length).toBeGreaterThan(0);
    });
  });

  it("renders strategy signals above open positions and enables rail controls for larger symbol sets", async () => {
    listBotsMock.mockResolvedValue([
      {
        id: "bot-rail",
        name: "Rail Bot",
        mode: "PAPER",
        paperStartBalance: 10000,
        marketType: "FUTURES",
        positionMode: "ONE_WAY",
        strategyId: "str-rail",
        isActive: true,
        liveOptIn: false,
        maxOpenPositions: 2,
      },
    ]);
    listBotRuntimeSessionsMock.mockResolvedValue([
      {
        id: "session-rail",
        botId: "bot-rail",
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
        eventsCount: 0,
        symbolsTracked: 5,
        summary: {
          totalSignals: 0,
          dcaCount: 0,
          closedTrades: 0,
          realizedPnl: 0,
        },
      },
    ]);
    listBotRuntimeSessionSymbolStatsMock.mockResolvedValue({
      sessionId: "session-rail",
      items: ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"].map((symbol, index) => ({
        id: `stat-rail-${index + 1}`,
        userId: "u-rail",
        botId: "bot-rail",
        sessionId: "session-rail",
        symbol,
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
        openPositionCount: 0,
        openPositionQty: 0,
        unrealizedPnl: 0,
        lastPrice: null,
        lastSignalAt: null,
        lastSignalDirection: "NEUTRAL",
        lastSignalDecisionAt: null,
        lastTradeAt: null,
        snapshotAt: "2026-03-31T10:05:00.000Z",
        createdAt: "2026-03-31T10:05:00.000Z",
        updatedAt: "2026-03-31T10:05:00.000Z",
      })),
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
        unrealizedPnl: 0,
        totalPnl: 0,
        grossProfit: 0,
        grossLoss: 0,
        feesPaid: 0,
      },
    });
    listBotRuntimeSessionPositionsMock.mockResolvedValue({
      sessionId: "session-rail",
      total: 0,
      openCount: 0,
      closedCount: 0,
      openOrdersCount: 0,
      showDynamicStopColumns: false,
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
    listBotRuntimeSessionTradesMock.mockResolvedValue({
      sessionId: "session-rail",
      total: 0,
      meta: {
        page: 1,
        pageSize: 25,
        total: 0,
        totalPages: 0,
        hasPrev: false,
        hasNext: false,
      },
      window: {
        startedAt: "2026-03-31T10:00:00.000Z",
        finishedAt: "2026-03-31T10:05:00.000Z",
      },
      items: [],
    });

    renderSubject();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Wstecz" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Dalej" })).toBeInTheDocument();
      expect(screen.getByText("SOLUSDT")).toBeInTheDocument();
    });

    const signalsAnchor = screen.getByText("SOLUSDT");
    const openPositionsHeading = screen.getByRole("heading", { name: "Otwarte pozycje" });
    expect(signalsAnchor.compareDocumentPosition(openPositionsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("supports apply-based filters, tri-state sorting and preserves state on auto-refresh", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    listBotsMock.mockResolvedValue([
      {
        id: "bot-2",
        name: "Filter Bot",
        mode: "PAPER",
        paperStartBalance: 10000,
        marketType: "FUTURES",
        positionMode: "ONE_WAY",
        strategyId: "str-2",
        isActive: true,
        liveOptIn: false,
        maxOpenPositions: 2,
      },
    ]);
    listBotRuntimeSessionsMock.mockResolvedValue([
      {
        id: "session-2",
        botId: "bot-2",
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
        eventsCount: 2,
        symbolsTracked: 1,
        summary: {
          totalSignals: 2,
          dcaCount: 0,
          closedTrades: 1,
          realizedPnl: 15,
        },
      },
    ]);
    listBotRuntimeSessionSymbolStatsMock.mockResolvedValue({
      sessionId: "session-2",
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
        unrealizedPnl: 0,
        totalPnl: 0,
        grossProfit: 0,
        grossLoss: 0,
        feesPaid: 0,
      },
    });
    listBotRuntimeSessionPositionsMock.mockResolvedValue({
      sessionId: "session-2",
      total: 0,
      openCount: 0,
      closedCount: 0,
      openOrdersCount: 0,
      showDynamicStopColumns: false,
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
    listBotRuntimeSessionTradesMock.mockResolvedValue({
      sessionId: "session-2",
      total: 3,
      meta: {
        page: 1,
        pageSize: 25,
        total: 3,
        totalPages: 2,
        hasPrev: false,
        hasNext: true,
      },
      window: {
        startedAt: "2026-03-31T10:00:00.000Z",
        finishedAt: "2026-03-31T10:05:00.000Z",
      },
      items: [
        {
          id: "trade-2",
          symbol: "BTCUSDT",
          side: "SELL",
          lifecycleAction: "CLOSE",
          price: 68100,
          quantity: 0.05,
          fee: 2,
          feeSource: "EXCHANGE_FILL",
          feePending: false,
          feeCurrency: "USDT",
          realizedPnl: 12,
          executedAt: "2026-03-31T10:03:00.000Z",
          orderId: "ord-2",
          positionId: "pos-2",
          strategyId: "str-2",
          origin: "BOT",
          managementMode: "BOT",
          notional: 3405,
          margin: 227,
        },
      ],
    });

    renderSubject();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    await waitFor(() => {
      expect(listBotRuntimeSessionTradesMock).toHaveBeenCalledWith("bot-2", "session-2", expect.objectContaining({
        page: 1,
        pageSize: 10,
      }));
    });

    expect(screen.queryByRole("option", { name: /Unknown/i })).not.toBeInTheDocument();

    const callsAfterInitialLoad = listBotRuntimeSessionTradesMock.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /Opcje zaawansowane/i }));
    fireEvent.change(screen.getByPlaceholderText("BTCUSDT"), { target: { value: "btcusdt" } });
    fireEvent.change(screen.getByLabelText("Side"), { target: { value: "SELL" } });
    fireEvent.change(screen.getByLabelText("Action"), { target: { value: "CLOSE" } });
    fireEvent.change(screen.getByLabelText("Od"), { target: { value: "2026-03-31T10:00" } });
    fireEvent.change(screen.getByLabelText("Do"), { target: { value: "2026-03-31T10:15" } });

    expect(listBotRuntimeSessionTradesMock.mock.calls.length).toBe(callsAfterInitialLoad);

    fireEvent.click(screen.getByRole("button", { name: "Zastosuj" }));

    await waitFor(() => {
      expect(listBotRuntimeSessionTradesMock).toHaveBeenLastCalledWith(
        "bot-2",
        "session-2",
        expect.objectContaining({
          page: 1,
          symbol: "BTCUSDT",
          side: "SELL",
          action: "CLOSE",
        })
      );
    });
    {
      const lastParams = listBotRuntimeSessionTradesMock.mock.calls.at(-1)?.[2] as Record<string, unknown>;
      expect(typeof lastParams.from).toBe("string");
      expect(typeof lastParams.to).toBe("string");
      const toDate = new Date(String(lastParams.to));
      expect(toDate.getUTCSeconds()).toBe(59);
      expect(toDate.getUTCMilliseconds()).toBe(999);
    }

    const tradesSection = screen
      .getByRole("heading", { name: "Historia transakcji" })
      .closest("section");
    expect(tradesSection).not.toBeNull();
    const marginSortButton = tradesSection
      ? within(tradesSection).getByRole("button", { name: /Margin/i })
      : null;
    expect(marginSortButton).not.toBeNull();

    fireEvent.click(marginSortButton!);

    await waitFor(() => {
      const lastParams = listBotRuntimeSessionTradesMock.mock.calls.at(-1)?.[2] as Record<string, unknown>;
      expect(lastParams.sortBy).toBe("margin");
      expect(lastParams.sortDir).toBe("asc");
      expect(lastParams.side).toBe("SELL");
      expect(lastParams.action).toBe("CLOSE");
    });

    fireEvent.click(marginSortButton!);

    await waitFor(() => {
      const lastParams = listBotRuntimeSessionTradesMock.mock.calls.at(-1)?.[2] as Record<string, unknown>;
      expect(lastParams.sortBy).toBe("margin");
      expect(lastParams.sortDir).toBe("desc");
    });

    fireEvent.click(marginSortButton!);

    await waitFor(() => {
      const lastParams = listBotRuntimeSessionTradesMock.mock.calls.at(-1)?.[2] as Record<string, unknown>;
      expect(lastParams).not.toHaveProperty("sortBy");
      expect(lastParams).not.toHaveProperty("sortDir");
    });

    const nextPageButton = tradesSection
      ? within(tradesSection).getByRole("button", { name: "Nastepna" })
      : null;
    expect(nextPageButton).not.toBeNull();
    fireEvent.click(nextPageButton!);

    await waitFor(() => {
      const lastParams = listBotRuntimeSessionTradesMock.mock.calls.at(-1)?.[2] as Record<string, unknown>;
      expect(lastParams.page).toBe(2);
      expect(lastParams.side).toBe("SELL");
      expect(lastParams.action).toBe("CLOSE");
      expect(lastParams.symbol).toBe("BTCUSDT");
      expect(lastParams).not.toHaveProperty("sortBy");
      expect(lastParams).not.toHaveProperty("sortDir");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_100);
    });

    await waitFor(() => {
      const lastParams = listBotRuntimeSessionTradesMock.mock.calls.at(-1)?.[2] as Record<string, unknown>;
      expect(lastParams.page).toBe(2);
      expect(lastParams.side).toBe("SELL");
      expect(lastParams.action).toBe("CLOSE");
      expect(lastParams.symbol).toBe("BTCUSDT");
      expect(lastParams).not.toHaveProperty("sortBy");
      expect(lastParams).not.toHaveProperty("sortDir");
    });
  }, 15_000);
});
