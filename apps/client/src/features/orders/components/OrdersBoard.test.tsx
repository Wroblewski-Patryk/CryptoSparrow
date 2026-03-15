import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import OrdersBoard from "./OrdersBoard";

const listMock = vi.hoisted(() => vi.fn());

vi.mock("../services/orders.service", () => ({
  listOrders: listMock,
}));

describe("OrdersBoard", () => {
  it("renders empty state for no orders", async () => {
    listMock.mockResolvedValue([]);
    render(<OrdersBoard />);

    await waitFor(() => {
      expect(screen.getByText("Brak orders")).toBeInTheDocument();
    });
  });

  it("renders table rows when orders exist", async () => {
    listMock.mockResolvedValue([
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

    render(<OrdersBoard />);

    await waitFor(() => {
      expect(screen.getByText("BTCUSDT")).toBeInTheDocument();
      expect(screen.getByText("MARKET")).toBeInTheDocument();
    });
  });
});
