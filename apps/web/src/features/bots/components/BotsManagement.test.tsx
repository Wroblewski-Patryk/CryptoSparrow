import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BotsManagement from "./BotsManagement";

const listMock = vi.hoisted(() => vi.fn());
const createMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());
const listStrategiesMock = vi.hoisted(() => vi.fn());
const listMarketUniversesMock = vi.hoisted(() => vi.fn());

vi.mock("../services/bots.service", () => ({
  listBots: listMock,
  createBot: createMock,
  updateBot: updateMock,
  deleteBot: deleteMock,
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
});

describe("BotsManagement", () => {
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
    fireEvent.change(screen.getByLabelText("Max open positions"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Dodaj bota" }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({
        name: "Momentum Runner",
        mode: "PAPER",
        paperStartBalance: 10000,
        strategyId: "s1",
        marketGroupId: "g1",
        isActive: false,
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
});
