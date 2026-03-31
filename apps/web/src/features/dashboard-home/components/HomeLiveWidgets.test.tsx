import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../../i18n/I18nProvider";
import HomeLiveWidgets from "./HomeLiveWidgets";

const listOrdersMock = vi.hoisted(() => vi.fn());
const listPositionsMock = vi.hoisted(() => vi.fn());

vi.mock("../../../features/orders/services/orders.service", () => ({
  listOrders: listOrdersMock,
}));

vi.mock("../../../features/positions/services/positions.service", () => ({
  listPositions: listPositionsMock,
}));

describe("HomeLiveWidgets", () => {
  const renderSubject = () =>
    render(
      <I18nProvider>
        <HomeLiveWidgets />
      </I18nProvider>
    );

  it("renders empty state when there are no trading records", async () => {
    listOrdersMock.mockResolvedValue([]);
    listPositionsMock.mockResolvedValue([]);

    renderSubject();

    await waitFor(() => {
      expect(screen.getByText("No trading data")).toBeInTheDocument();
    });
  });

  it("renders live snapshot cards and feed from api data", async () => {
    listOrdersMock.mockResolvedValue([
      {
        id: "o1",
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        status: "FILLED",
        quantity: 0.1,
        price: 64000,
        filledQuantity: 0.1,
        createdAt: "2026-03-16T12:00:00.000Z",
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
        openedAt: "2026-03-16T11:00:00.000Z",
      },
    ]);

    renderSubject();

    await waitFor(() => {
      expect(screen.getByText("Control center lanes")).toBeInTheDocument();
      expect(screen.getByText("Reports")).toBeInTheDocument();
      expect(screen.getByText("Event")).toBeInTheDocument();
      expect(screen.getAllByText("ETHUSDT").length).toBeGreaterThan(0);
      expect(screen.getByText(/MARKET BTCUSDT BUY/i)).toBeInTheDocument();
    });
  });
});
