import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PositionsBoard from "./PositionsBoard";

const listMock = vi.hoisted(() => vi.fn());

vi.mock("../services/positions.service", () => ({
  listPositions: listMock,
}));

describe("PositionsBoard", () => {
  it("renders empty state for no positions", async () => {
    listMock.mockResolvedValue([]);
    render(<PositionsBoard />);

    await waitFor(() => {
      expect(screen.getByText("Brak positions")).toBeInTheDocument();
    });
  });

  it("renders table rows when positions exist", async () => {
    listMock.mockResolvedValue([
      {
        id: "p1",
        symbol: "ETHUSDT",
        side: "LONG",
        status: "OPEN",
        entryPrice: 3000,
        quantity: 0.5,
        leverage: 5,
        unrealizedPnl: 12.4,
        realizedPnl: null,
        openedAt: "2026-03-16T09:00:00.000Z",
      },
    ]);

    render(<PositionsBoard />);

    await waitFor(() => {
      expect(screen.getByText("ETHUSDT")).toBeInTheDocument();
      expect(screen.getByText("LONG")).toBeInTheDocument();
    });
  });
});
