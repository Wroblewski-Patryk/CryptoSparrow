import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AuditTrailView from "./AuditTrailView";

const listOrdersMock = vi.hoisted(() => vi.fn());
const listPositionsMock = vi.hoisted(() => vi.fn());
const listRunsMock = vi.hoisted(() => vi.fn());

vi.mock("../../orders/services/orders.service", () => ({
  listOrders: listOrdersMock,
}));

vi.mock("../../positions/services/positions.service", () => ({
  listPositions: listPositionsMock,
}));

vi.mock("../../backtest/services/backtests.service", () => ({
  listBacktestRuns: listRunsMock,
}));

describe("AuditTrailView", () => {
  it("renders empty state when all sources are empty", async () => {
    listOrdersMock.mockResolvedValue([]);
    listPositionsMock.mockResolvedValue([]);
    listRunsMock.mockResolvedValue([]);

    render(<AuditTrailView />);

    await waitFor(() => {
      expect(screen.getByText("Brak zdarzen audit trail")).toBeInTheDocument();
    });
  });

  it("renders entries and filters by source", async () => {
    listOrdersMock.mockResolvedValue([
      {
        id: "o1",
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        status: "FILLED",
        quantity: 0.1,
        price: 65000,
        filledQuantity: 0.1,
        createdAt: "2026-03-16T10:00:00.000Z",
      },
    ]);
    listPositionsMock.mockResolvedValue([
      {
        id: "p1",
        symbol: "ETHUSDT",
        side: "LONG",
        status: "OPEN",
        entryPrice: 3000,
        quantity: 0.5,
        leverage: 5,
        unrealizedPnl: 10,
        realizedPnl: null,
        openedAt: "2026-03-16T09:00:00.000Z",
      },
    ]);
    listRunsMock.mockResolvedValue([
      {
        id: "r1",
        strategyId: null,
        name: "Run Alpha",
        symbol: "BTCUSDT",
        timeframe: "5m",
        status: "COMPLETED",
        startedAt: "2026-03-16T08:00:00.000Z",
        finishedAt: "2026-03-16T09:00:00.000Z",
        notes: null,
        createdAt: "2026-03-16T08:00:00.000Z",
      },
    ]);

    render(<AuditTrailView />);

    await waitFor(() => {
      expect(screen.getByText("Audit trail loaded")).toBeInTheDocument();
      expect(screen.getByText(/order.state.changed/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Backtests" }));
    await waitFor(() => {
      expect(screen.getByText(/backtest.run/i)).toBeInTheDocument();
    });
  });
});

