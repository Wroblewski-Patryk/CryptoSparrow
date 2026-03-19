import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BotsManagement from "./BotsManagement";

const listMock = vi.hoisted(() => vi.fn());
const createMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());

vi.mock("../services/bots.service", () => ({
  listBots: listMock,
  createBot: createMock,
  updateBot: updateMock,
  deleteBot: deleteMock,
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BotsManagement", () => {
  it("requires confirmation before creating LIVE bot", async () => {
    listMock.mockResolvedValue([]);
    createMock.mockResolvedValue({
      id: "b-live",
      name: "Live Runner",
      mode: "LIVE",
      marketType: "FUTURES",
      isActive: false,
      liveOptIn: false,
      maxOpenPositions: 1,
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<BotsManagement />);

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

    render(<BotsManagement />);

    await waitFor(() => {
      expect(screen.getByText("Brak botow")).toBeInTheDocument();
    });
  });

  it("creates bot from form fields", async () => {
    listMock.mockResolvedValue([]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    createMock.mockResolvedValue({
      id: "b1",
      name: "Momentum Runner",
      mode: "PAPER",
      marketType: "FUTURES",
      isActive: false,
      liveOptIn: false,
      maxOpenPositions: 3,
    });

    render(<BotsManagement />);

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
        marketType: "FUTURES",
        isActive: false,
        liveOptIn: false,
        consentTextVersion: null,
        maxOpenPositions: 3,
      });
    });
  });

  it("filters bots by market type", async () => {
    listMock.mockResolvedValue([
      {
        id: "b-futures",
        name: "Futures Bot",
        mode: "PAPER",
        marketType: "FUTURES",
        isActive: false,
        liveOptIn: false,
        maxOpenPositions: 1,
      },
      {
        id: "b-spot",
        name: "Spot Bot",
        mode: "PAPER",
        marketType: "SPOT",
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

    expect(screen.queryByDisplayValue("Futures Bot")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Spot Bot")).toBeInTheDocument();
  });
});
