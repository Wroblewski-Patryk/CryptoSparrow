import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PositionsBoard from "./PositionsBoard";

const listMock = vi.hoisted(() => vi.fn());
const snapshotMock = vi.hoisted(() => vi.fn());

vi.mock("../services/positions.service", () => ({
  listPositions: listMock,
  fetchExchangePositionsSnapshot: snapshotMock,
}));

describe("PositionsBoard", () => {
  it("renders empty state for no positions", async () => {
    listMock.mockResolvedValue([]);
    snapshotMock.mockResolvedValue({
      source: "BINANCE",
      syncedAt: "2026-03-21T19:00:00.000Z",
      positions: [],
    });
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
    snapshotMock.mockResolvedValue({
      source: "BINANCE",
      syncedAt: "2026-03-21T19:00:00.000Z",
      positions: [],
    });

    render(<PositionsBoard />);

    await waitFor(() => {
      expect(screen.getByText("ETHUSDT")).toBeInTheDocument();
      expect(screen.getByText("LONG")).toBeInTheDocument();
    });
  });

  it("loads exchange snapshot when source is switched", async () => {
    listMock.mockResolvedValue([]);
    snapshotMock.mockResolvedValue({
      source: "BINANCE",
      syncedAt: "2026-03-21T20:00:00.000Z",
      positions: [
        {
          symbol: "BTC/USDT:USDT",
          side: "long",
          contracts: 0.01,
          entryPrice: 50000,
          markPrice: 50100,
          unrealizedPnl: 1,
          leverage: 2,
          marginMode: "isolated",
          liquidationPrice: 42000,
          timestamp: "2026-03-21T20:00:00.000Z",
        },
      ],
    });

    render(<PositionsBoard />);

    const sourceSelect = await screen.findByRole("combobox", { name: "Zrodlo" });
    fireEvent.change(sourceSelect, { target: { value: "exchange" } });

    await waitFor(() => {
      expect(snapshotMock).toHaveBeenCalled();
      expect(screen.getByText("BTC/USDT:USDT")).toBeInTheDocument();
      expect(screen.getByText("LONG")).toBeInTheDocument();
    });
  });

  it("shows error state for exchange snapshot failure", async () => {
    listMock.mockResolvedValue([]);
    snapshotMock.mockRejectedValue({
      isAxiosError: true,
      response: {
        data: {
          message: "Unable to fetch exchange positions snapshot.",
        },
      },
    });

    render(<PositionsBoard />);

    const sourceSelect = await screen.findByRole("combobox", { name: "Zrodlo" });
    fireEvent.change(sourceSelect, { target: { value: "exchange" } });

    await waitFor(() => {
      expect(screen.getByText("Nie udalo sie pobrac positions")).toBeInTheDocument();
      expect(screen.getByText("Unable to fetch exchange positions snapshot.")).toBeInTheDocument();
    });
  });
});
