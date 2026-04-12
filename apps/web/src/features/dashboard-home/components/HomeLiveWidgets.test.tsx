import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../../i18n/I18nProvider";
import HomeLiveWidgets from "./HomeLiveWidgets";

const listBotsMock = vi.hoisted(() => vi.fn());
const getBotRuntimeGraphMock = vi.hoisted(() => vi.fn());
const listBotRuntimeSessionsMock = vi.hoisted(() => vi.fn());
const listBotRuntimeSessionSymbolStatsMock = vi.hoisted(() => vi.fn());
const listBotRuntimeSessionPositionsMock = vi.hoisted(() => vi.fn());
const listBotRuntimeSessionTradesMock = vi.hoisted(() => vi.fn());
const closeBotRuntimeSessionPositionMock = vi.hoisted(() => vi.fn());
const lookupCoinIconsMock = vi.hoisted(() => vi.fn());

vi.mock("../../../features/bots/services/bots.service", () => ({
  listBots: listBotsMock,
  getBotRuntimeGraph: getBotRuntimeGraphMock,
  listBotRuntimeSessions: listBotRuntimeSessionsMock,
  listBotRuntimeSessionSymbolStats: listBotRuntimeSessionSymbolStatsMock,
  listBotRuntimeSessionPositions: listBotRuntimeSessionPositionsMock,
  listBotRuntimeSessionTrades: listBotRuntimeSessionTradesMock,
  closeBotRuntimeSessionPosition: closeBotRuntimeSessionPositionMock,
}));

vi.mock("../../../features/icons/services/icons.service", () => ({
  lookupCoinIcons: lookupCoinIconsMock,
}));

describe("HomeLiveWidgets", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    lookupCoinIconsMock.mockReset();
    lookupCoinIconsMock.mockResolvedValue(new Map());
    getBotRuntimeGraphMock.mockReset();
    closeBotRuntimeSessionPositionMock.mockReset();
    closeBotRuntimeSessionPositionMock.mockResolvedValue({
      status: "closed",
      positionId: "position-default",
      orderId: "order-default",
    });
  });

  const renderSubject = () => {
    window.localStorage.setItem("cryptosparrow-locale", "pl");
    lookupCoinIconsMock.mockResolvedValue(new Map());
    getBotRuntimeGraphMock.mockImplementation(async (botId: string) => ({
      bot: {
        id: botId,
        userId: "u-1",
        name: "Runtime bot",
        mode: "PAPER",
        marketType: "FUTURES",
        positionMode: "ONE_WAY",
        isActive: true,
        liveOptIn: false,
        maxOpenPositions: 3,
        createdAt: "2026-03-31T10:00:00.000Z",
        updatedAt: "2026-03-31T10:00:00.000Z",
      },
      marketGroups: [
        {
          id: "group-link-1",
          botId,
          symbolGroupId: "group-1",
          lifecycleStatus: "ACTIVE",
          executionOrder: 1,
          isEnabled: true,
          createdAt: "2026-03-31T10:00:00.000Z",
          updatedAt: "2026-03-31T10:00:00.000Z",
          symbolGroup: {
            id: "group-1",
            name: "Ulubione",
            symbols: ["BTCUSDT", "ETHUSDT"],
            marketUniverseId: "mu-1",
          },
          strategies: [
            {
              id: "group-strategy-1",
              strategyId: "str-1",
              priority: 1,
              weight: 1,
              isEnabled: true,
              createdAt: "2026-03-31T10:00:00.000Z",
              updatedAt: "2026-03-31T10:00:00.000Z",
              strategy: {
                id: "str-1",
                name: "Test RSI",
                interval: "5m",
              },
            },
          ],
        },
      ],
      legacyBotStrategies: [],
    }));
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
      expect(screen.getAllByText(/Dodaj bota|Stworz i aktywuj bota|Create and activate bot/i).length).toBeGreaterThan(0);
    });
  });

  it("renders no-active-bots onboarding with activation step and no footer CTA buttons", async () => {
    listBotsMock.mockResolvedValue([
      {
        id: "inactive-bot-1",
        name: "Inactive Bot",
        mode: "PAPER",
        paperStartBalance: 10000,
        marketType: "FUTURES",
        positionMode: "ONE_WAY",
        strategyId: "str-inactive-1",
        isActive: false,
        liveOptIn: false,
        maxOpenPositions: 2,
      },
    ]);

    const { container } = renderSubject();

    await waitFor(() => {
      expect(screen.getByText("Brak aktywnych botow na dashboardzie")).toBeInTheDocument();
      expect(screen.getByText("Aktywuj istniejacego bota")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Otworz liste botow" })).toBeInTheDocument();
    });

    expect(container.querySelector(".btn.btn-primary.btn-sm")).toBeNull();
    expect(container.querySelector(".btn.btn-outline.btn-sm")).toBeNull();
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
      expect(screen.getByRole("tab", { name: /Otwarte pozycje|Open positions/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Otwarte zlecenia|Open orders/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Historia transakcji|Trade history/i })).toBeInTheDocument();
      expect(screen.getByText(/Wybrany bot|Selected bot/i)).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /Monitor Bot/i })).toBeInTheDocument();
      expect(screen.getAllByText("RUNNING").length).toBeGreaterThan(0);
      expect(screen.getAllByText("BTCUSDT").length).toBeGreaterThan(0);
      expect(screen.getByText("Rynki:")).toBeInTheDocument();
      expect(screen.getByText("Sygnaly:")).toBeInTheDocument();
      expect(
        screen.getAllByText(
          (content) => /\d{2}\.\d{2}\.\d{4}/.test(content) && /\d{2}:\d{2}:\d{2}/.test(content)
        ).length
      ).toBeGreaterThan(0);
      expect(screen.getByTitle("1:-15%, 2:-30%")).toBeInTheDocument();
      expect(screen.getByText("TTP")).toBeInTheDocument();
      expect(screen.getByText("TSL")).toBeInTheDocument();
      expect(
        screen.getByText((content) => /5[.,]0[56]%/.test(content.replace(/\u00a0/g, " ")))
      ).toBeInTheDocument();
      expect(screen.getAllByText("-").length).toBeGreaterThan(0);
    });
    {
      const openPositionsTab = screen.getByRole("tab", { name: /Otwarte pozycje|Open positions/i });
      const openOrdersTab = screen.getByRole("tab", { name: /Otwarte zlecenia|Open orders/i });
      const tradeHistoryTab = screen.getByRole("tab", { name: /Historia transakcji|Trade history/i });

      expect(openPositionsTab.compareDocumentPosition(openOrdersTab) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(openOrdersTab.compareDocumentPosition(tradeHistoryTab) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }

    expect(lookupCoinIconsMock).toHaveBeenCalledWith(expect.arrayContaining(["BTCUSDT", "ETHUSDT"]));

    fireEvent.click(screen.getByRole("tab", { name: /Historia transakcji/i }));
    expect(screen.queryByRole("columnheader", { name: /^Fee$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /^Origin$/i })).not.toBeInTheDocument();
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
      expect(screen.getByRole("button", { name: /Wstecz|Prev/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Dalej|Next/i })).toBeInTheDocument();
      expect(screen.getByText("SOLUSDT")).toBeInTheDocument();
    });

    const signalsAnchor = screen.getByText("SOLUSDT");
    const openPositionsTab = screen.getByRole("tab", { name: /Otwarte pozycje|Open positions/i });
    expect(openPositionsTab.compareDocumentPosition(signalsAnchor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders LIVE wallet metrics from runtime capital snapshot in sidebar widget", async () => {
    listBotsMock.mockResolvedValue([
      {
        id: "bot-live-wallet",
        name: "Live Wallet Bot",
        mode: "LIVE",
        paperStartBalance: 10000,
        marketType: "FUTURES",
        positionMode: "ONE_WAY",
        strategyId: "str-live-wallet",
        isActive: true,
        liveOptIn: true,
        maxOpenPositions: 2,
        wallet: {
          id: "wallet-live-1",
          name: "Glowny",
          mode: "LIVE",
          exchange: "BINANCE",
          marketType: "FUTURES",
          baseCurrency: "USDT",
          paperInitialBalance: 10000,
          liveAllocationMode: "PERCENT",
          liveAllocationValue: 100,
        },
      },
    ]);

    listBotRuntimeSessionsMock.mockResolvedValue([
      {
        id: "session-live-wallet",
        botId: "bot-live-wallet",
        mode: "LIVE",
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
          totalSignals: 1,
          dcaCount: 0,
          closedTrades: 0,
          realizedPnl: 0,
        },
      },
    ]);

    listBotRuntimeSessionSymbolStatsMock.mockResolvedValue({
      sessionId: "session-live-wallet",
      items: [
        {
          id: "stat-live-wallet",
          userId: "u-live",
          botId: "bot-live-wallet",
          sessionId: "session-live-wallet",
          symbol: "BTCUSDT",
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
          openPositionCount: 1,
          openPositionQty: 0.01,
          unrealizedPnl: 0,
          lastPrice: 70000,
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
        totalSignals: 1,
        longEntries: 1,
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
      sessionId: "session-live-wallet",
      total: 1,
      openCount: 1,
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
        referenceBalance: 100,
        freeCash: 98.84,
      },
      openOrders: [],
      openItems: [
        {
          id: "pos-live-wallet",
          symbol: "BTCUSDT",
          side: "LONG",
          status: "OPEN",
          quantity: 0.01,
          leverage: 10,
          entryPrice: 1160,
          entryNotional: 11.6,
          exitPrice: null,
          stopLoss: null,
          takeProfit: null,
          openedAt: "2026-03-31T10:03:00.000Z",
          closedAt: null,
          holdMs: 120000,
          dcaCount: 0,
          dcaPlannedLevels: [],
          dcaExecutedLevels: [],
          feesPaid: 0,
          realizedPnl: 0,
          unrealizedPnl: 0,
          markPrice: 1160,
          dynamicTtpStopLoss: null,
          dynamicTslStopLoss: null,
          firstTradeAt: "2026-03-31T10:03:00.000Z",
          lastTradeAt: "2026-03-31T10:03:00.000Z",
          tradesCount: 1,
        },
      ],
      historyItems: [],
    });

    listBotRuntimeSessionTradesMock.mockResolvedValue({
      sessionId: "session-live-wallet",
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
      expect(screen.getByText(/100[,.]00\s*USDT/)).toBeInTheDocument();
      expect(screen.getByText(/98[,.]84\s*USDT/)).toBeInTheDocument();
      expect(screen.getByText(/1[,.]16\s*USDT/)).toBeInTheDocument();
    });
  });

  it("renders LIVE wallet metrics from compatibility capital fields when referenceBalance/freeCash are absent", async () => {
    listBotsMock.mockResolvedValue([
      {
        id: "bot-live-wallet-compat",
        name: "Live Wallet Compat",
        mode: "LIVE",
        paperStartBalance: 10000,
        marketType: "FUTURES",
        positionMode: "ONE_WAY",
        strategyId: "str-live-wallet-compat",
        isActive: true,
        liveOptIn: true,
        maxOpenPositions: 2,
        wallet: {
          id: "wallet-live-compat-1",
          name: "Glowny",
          mode: "LIVE",
          exchange: "BINANCE",
          marketType: "FUTURES",
          baseCurrency: "USDT",
          paperInitialBalance: 10000,
          liveAllocationMode: "PERCENT",
          liveAllocationValue: 100,
        },
      },
    ]);

    listBotRuntimeSessionsMock.mockResolvedValue([
      {
        id: "session-live-wallet-compat",
        botId: "bot-live-wallet-compat",
        mode: "LIVE",
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
          totalSignals: 1,
          dcaCount: 0,
          closedTrades: 0,
          realizedPnl: 0,
        },
      },
    ]);

    listBotRuntimeSessionSymbolStatsMock.mockResolvedValue({
      sessionId: "session-live-wallet-compat",
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
      sessionId: "session-live-wallet-compat",
      total: 1,
      openCount: 1,
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
        accountBalance: 200,
        availableBalance: 194.2,
      },
      openOrders: [],
      openItems: [
        {
          id: "pos-live-wallet-compat",
          symbol: "BTCUSDT",
          side: "LONG",
          status: "OPEN",
          quantity: 0.01,
          leverage: 10,
          entryPrice: 5800,
          entryNotional: 58,
          exitPrice: null,
          stopLoss: null,
          takeProfit: null,
          openedAt: "2026-03-31T10:03:00.000Z",
          closedAt: null,
          holdMs: 120000,
          dcaCount: 0,
          dcaPlannedLevels: [],
          dcaExecutedLevels: [],
          feesPaid: 0,
          realizedPnl: 0,
          unrealizedPnl: 0,
          markPrice: 5800,
          dynamicTtpStopLoss: null,
          dynamicTslStopLoss: null,
          firstTradeAt: "2026-03-31T10:03:00.000Z",
          lastTradeAt: "2026-03-31T10:03:00.000Z",
          tradesCount: 1,
        },
      ],
      historyItems: [],
    });

    listBotRuntimeSessionTradesMock.mockResolvedValue({
      sessionId: "session-live-wallet-compat",
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
      const portfolioLabel = screen
        .getAllByText(/Portfel|Portfolio/i)
        .find((node) => node.className.includes("inline-flex"));
      const portfolioRow = portfolioLabel?.closest("p");
      const portfolioValue = portfolioRow?.querySelector("span:last-child")?.textContent ?? "";
      expect(portfolioValue).toMatch(/200/);
      expect(portfolioValue.trim()).not.toBe("-");

      const freeFundsCard = screen.getByText(/Wolne srodki|Free funds/i).closest("div");
      const freeFundsValue = freeFundsCard?.querySelector("p.text-xs.font-semibold")?.textContent ?? "";
      expect(freeFundsValue).toMatch(/194/);
      expect(freeFundsValue.trim()).not.toBe("-");

      const inPositionsCard = screen.getByText(/W pozycjach|In positions/i).closest("div");
      const inPositionsValue = inPositionsCard?.querySelector("p.text-xs.font-semibold")?.textContent ?? "";
      expect(inPositionsValue).toMatch(/5/);
      expect(inPositionsValue.trim()).not.toBe("-");
    });
  });

  it("does not render takeover column for imported exchange positions in runtime table", async () => {
    listBotsMock.mockResolvedValue([
      {
        id: "bot-takeover",
        name: "Takeover Bot",
        mode: "LIVE",
        paperStartBalance: 10000,
        marketType: "FUTURES",
        positionMode: "ONE_WAY",
        strategyId: "str-takeover",
        isActive: true,
        liveOptIn: true,
        maxOpenPositions: 2,
      },
    ]);

    listBotRuntimeSessionsMock.mockResolvedValue([
      {
        id: "session-takeover",
        botId: "bot-takeover",
        mode: "LIVE",
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
          totalSignals: 1,
          dcaCount: 0,
          closedTrades: 0,
          realizedPnl: 0,
        },
      },
    ]);

    listBotRuntimeSessionSymbolStatsMock.mockResolvedValue({
      sessionId: "session-takeover",
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
      sessionId: "session-takeover",
      total: 1,
      openCount: 1,
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
        referenceBalance: 100,
        freeCash: 94.2,
      },
      openOrders: [],
      openItems: [
        {
          id: "pos-takeover",
          origin: "EXCHANGE_SYNC",
          managementMode: "BOT_MANAGED",
          syncState: "IN_SYNC",
          takeoverStatus: "OWNED_AND_MANAGED",
          symbol: "BNBUSDT",
          side: "LONG",
          status: "OPEN",
          quantity: 0.1,
          leverage: 10,
          entryPrice: 580,
          entryNotional: 58,
          exitPrice: null,
          stopLoss: null,
          takeProfit: null,
          openedAt: "2026-03-31T10:03:00.000Z",
          closedAt: null,
          holdMs: 120000,
          dcaCount: 0,
          dcaPlannedLevels: [],
          dcaExecutedLevels: [],
          feesPaid: 0,
          realizedPnl: 0,
          unrealizedPnl: 0,
          markPrice: 580,
          dynamicTtpStopLoss: null,
          dynamicTslStopLoss: null,
          firstTradeAt: "2026-03-31T10:03:00.000Z",
          lastTradeAt: "2026-03-31T10:03:00.000Z",
          tradesCount: 1,
        },
      ],
      historyItems: [],
    });

    listBotRuntimeSessionTradesMock.mockResolvedValue({
      sessionId: "session-takeover",
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
      expect(screen.queryByRole("columnheader", { name: "Takeover" })).not.toBeInTheDocument();
      expect(screen.queryByText("OWNED")).not.toBeInTheDocument();
      expect(screen.getAllByText("BNBUSDT").length).toBeGreaterThan(0);
    });
  });

  it("closes open runtime position from dashboard table action", async () => {
    listBotsMock.mockResolvedValue([
      {
        id: "bot-close-position",
        name: "Close Position Bot",
        mode: "LIVE",
        paperStartBalance: 10000,
        marketType: "FUTURES",
        positionMode: "ONE_WAY",
        strategyId: "str-close-position",
        isActive: true,
        liveOptIn: true,
        maxOpenPositions: 2,
      },
    ]);

    listBotRuntimeSessionsMock.mockResolvedValue([
      {
        id: "session-close-position",
        botId: "bot-close-position",
        mode: "LIVE",
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

    listBotRuntimeSessionSymbolStatsMock.mockResolvedValue({
      sessionId: "session-close-position",
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
      sessionId: "session-close-position",
      total: 1,
      openCount: 1,
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
        referenceBalance: 200,
        freeCash: 194,
      },
      openOrders: [],
      openItems: [
        {
          id: "pos-close-1",
          origin: "BOT",
          managementMode: "BOT_MANAGED",
          syncState: "IN_SYNC",
          takeoverStatus: "OWNED_AND_MANAGED",
          symbol: "BTCUSDT",
          side: "LONG",
          status: "OPEN",
          quantity: 0.01,
          leverage: 10,
          entryPrice: 68000,
          entryNotional: 68,
          exitPrice: null,
          stopLoss: null,
          takeProfit: null,
          openedAt: "2026-03-31T10:03:00.000Z",
          closedAt: null,
          holdMs: 120000,
          dcaCount: 0,
          dcaPlannedLevels: [],
          dcaExecutedLevels: [],
          feesPaid: 0,
          realizedPnl: 0,
          unrealizedPnl: 0,
          markPrice: 68000,
          dynamicTtpStopLoss: null,
          dynamicTslStopLoss: null,
          firstTradeAt: "2026-03-31T10:03:00.000Z",
          lastTradeAt: "2026-03-31T10:03:00.000Z",
          tradesCount: 1,
        },
      ],
      historyItems: [],
    });

    listBotRuntimeSessionTradesMock.mockResolvedValue({
      sessionId: "session-close-position",
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
    const openPositionsTab = await screen.findByRole("tab", { name: /Otwarte pozycje|Open positions/i });
    fireEvent.click(openPositionsTab);
    const closeButton = await screen.findByRole("button", { name: /Zamknij pozycje|Close position/i });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(closeBotRuntimeSessionPositionMock).toHaveBeenCalledWith(
        "bot-close-position",
        "session-close-position",
        "pos-close-1",
        { riskAck: true }
      );
    });
  });

  it("renders runtime open positions even when symbol stats are temporarily empty", async () => {
    listBotsMock.mockResolvedValue([
      {
        id: "bot-external-runtime",
        name: "External Runtime Bot",
        mode: "LIVE",
        paperStartBalance: 10000,
        marketType: "FUTURES",
        positionMode: "ONE_WAY",
        strategyId: "str-external-runtime",
        isActive: true,
        liveOptIn: true,
        maxOpenPositions: 2,
      },
    ]);

    listBotRuntimeSessionsMock.mockResolvedValue([
      {
        id: "session-external-runtime",
        botId: "bot-external-runtime",
        mode: "LIVE",
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
        symbolsTracked: 0,
        summary: {
          totalSignals: 0,
          dcaCount: 0,
          closedTrades: 0,
          realizedPnl: 0,
        },
      },
    ]);

    listBotRuntimeSessionSymbolStatsMock.mockResolvedValue({
      sessionId: "session-external-runtime",
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
      sessionId: "session-external-runtime",
      total: 1,
      openCount: 1,
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
        referenceBalance: 200,
        freeCash: 198,
      },
      openOrders: [],
      openItems: [
        {
          id: "pos-external-runtime",
          symbol: "BNBUSDT",
          side: "LONG",
          status: "OPEN",
          quantity: 0.1,
          leverage: 10,
          entryPrice: 580,
          entryNotional: 58,
          exitPrice: null,
          stopLoss: null,
          takeProfit: null,
          openedAt: "2026-03-31T10:03:00.000Z",
          closedAt: null,
          holdMs: 120000,
          dcaCount: 0,
          dcaPlannedLevels: [],
          dcaExecutedLevels: [],
          feesPaid: 0,
          realizedPnl: 0,
          unrealizedPnl: 0,
          markPrice: 580,
          dynamicTtpStopLoss: null,
          dynamicTslStopLoss: null,
          firstTradeAt: "2026-03-31T10:03:00.000Z",
          lastTradeAt: "2026-03-31T10:03:00.000Z",
          tradesCount: 1,
        },
      ],
      historyItems: [],
    });

    listBotRuntimeSessionTradesMock.mockResolvedValue({
      sessionId: "session-external-runtime",
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
      expect(screen.getAllByText("BNBUSDT").length).toBeGreaterThan(0);
    });
  });

  it("shows stale-data warning after refresh gaps and clears it after fresh payload arrives", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    let shouldFailRefresh = false;

    listBotsMock.mockResolvedValue([
      {
        id: "bot-stale",
        name: "Stale Guard Bot",
        mode: "PAPER",
        paperStartBalance: 10000,
        marketType: "FUTURES",
        positionMode: "ONE_WAY",
        strategyId: "str-stale",
        isActive: true,
        liveOptIn: false,
        maxOpenPositions: 2,
      },
    ]);

    listBotRuntimeSessionsMock.mockImplementation(async () => {
      if (shouldFailRefresh) throw new Error("stale-refresh");
      return [
        {
          id: "session-stale",
          botId: "bot-stale",
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
          eventsCount: 4,
          symbolsTracked: 1,
          summary: {
            totalSignals: 2,
            dcaCount: 0,
            closedTrades: 1,
            realizedPnl: 10,
          },
        },
      ];
    });

    listBotRuntimeSessionSymbolStatsMock.mockImplementation(async () => {
      if (shouldFailRefresh) throw new Error("stale-refresh");
      return {
        sessionId: "session-stale",
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
      };
    });

    listBotRuntimeSessionPositionsMock.mockImplementation(async () => {
      if (shouldFailRefresh) throw new Error("stale-refresh");
      return {
        sessionId: "session-stale",
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
      };
    });

    listBotRuntimeSessionTradesMock.mockImplementation(async () => {
      if (shouldFailRefresh) throw new Error("stale-refresh");
      return {
        sessionId: "session-stale",
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
      };
    });

    renderSubject();

    await waitFor(() => {
      expect(screen.getByText(/Aktualizacja:/i)).toBeInTheDocument();
    });

    shouldFailRefresh = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(21_000);
    });

    await waitFor(() => {
      expect(screen.getByText(/Dane runtime moga byc przestarzale/i)).toBeInTheDocument();
    });

    shouldFailRefresh = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
    });

    await waitFor(() => {
      expect(screen.queryByText(/Dane runtime moga byc przestarzale/i)).not.toBeInTheDocument();
    });
  }, 20_000);

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

    const tradeHistoryTab = screen.getByRole("tab", { name: /Historia transakcji/i });
    fireEvent.click(tradeHistoryTab);

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

    const historyTab = screen.getByRole("tab", { name: /Historia transakcji/i });
    fireEvent.click(historyTab);

    const marginSortButton = screen.getByRole("button", { name: /Margin/i });
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

    const nextPageButton = screen.getByRole("button", { name: "Nastepna" });
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
