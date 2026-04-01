import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
  const renderSubject = () =>
    render(
      <I18nProvider>
        <HomeLiveWidgets />
      </I18nProvider>
    );

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
          dcaCount: 0,
          feesPaid: 0,
          realizedPnl: 0,
          unrealizedPnl: 35,
          markPrice: 68290,
          firstTradeAt: "2026-03-31T10:03:00.000Z",
          lastTradeAt: "2026-03-31T10:04:00.000Z",
          tradesCount: 1,
        },
      ],
      historyItems: [],
    });
    listBotRuntimeSessionTradesMock.mockResolvedValue({
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
          price: 68000,
          quantity: 0.12,
          fee: 0,
          realizedPnl: 0,
          executedAt: "2026-03-31T10:03:00.000Z",
          orderId: "ord-1",
          positionId: "pos-1",
          strategyId: "str-1",
          origin: "BOT",
          managementMode: "SIGNAL",
          notional: 8160,
        },
      ],
    });

    renderSubject();

    await waitFor(() => {
      expect(screen.getByText("Otwarte pozycje")).toBeInTheDocument();
      expect(screen.getByText("Bot runtime")).toBeInTheDocument();
      expect(screen.getByText("Ryzyko")).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /Monitor Bot/i })).toBeInTheDocument();
      expect(screen.getAllByText("RUNNING").length).toBeGreaterThan(0);
      expect(screen.getByText("Live checks")).toBeInTheDocument();
      expect(screen.getAllByText("BTCUSDT").length).toBeGreaterThan(0);
    });
  });
});
