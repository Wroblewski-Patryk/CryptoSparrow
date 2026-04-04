import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/i18n/I18nProvider";

import BotsListTable from "./BotsListTable";

const listBotsMock = vi.hoisted(() => vi.fn());
const deleteBotMock = vi.hoisted(() => vi.fn());
const listStrategiesMock = vi.hoisted(() => vi.fn());

vi.mock("../services/bots.service", () => ({
  listBots: listBotsMock,
  deleteBot: deleteBotMock,
}));

vi.mock("@/features/strategies/api/strategies.api", () => ({
  listStrategies: listStrategiesMock,
}));

const renderWithI18n = () => {
  window.localStorage.setItem("cryptosparrow-locale", "pl");
  return render(
    <I18nProvider>
      <BotsListTable />
    </I18nProvider>
  );
};

describe("BotsListTable", () => {
  it("renders canonical list-table action links for runtime, assistant and edit form", async () => {
    listStrategiesMock.mockResolvedValue([
      {
        id: "strat-1",
        name: "Trend Pulse",
        interval: "5m",
        leverage: 10,
      },
    ]);
    listBotsMock.mockResolvedValue([
      {
        id: "bot-1",
        name: "Paper Bot",
        mode: "PAPER",
        paperStartBalance: 10_000,
        exchange: "BINANCE",
        marketType: "FUTURES",
        positionMode: "ONE_WAY",
        strategyId: "strat-1",
        isActive: true,
        liveOptIn: false,
        maxOpenPositions: 1,
      },
    ]);

    renderWithI18n();

    await waitFor(() => {
      expect(screen.getByText("Paper Bot")).toBeInTheDocument();
    });

    const runtimeLink = screen.getByRole("link", { name: /operacje runtime/i });
    const assistantLink = screen.getByRole("link", { name: /asystent/i });
    const editLink = screen.getByRole("link", { name: /edytuj/i });

    expect(runtimeLink).toHaveAttribute("href", "/dashboard/bots/runtime?botId=bot-1");
    expect(assistantLink).toHaveAttribute("href", "/dashboard/bots/assistant?botId=bot-1");
    expect(editLink).toHaveAttribute("href", "/dashboard/bots/create?editId=bot-1");
  });

  it("shows placeholder badge for unsupported exchange and supports filtering by exchange name", async () => {
    listStrategiesMock.mockResolvedValue([
      {
        id: "strat-2",
        name: "Placeholder Strategy",
        interval: "5m",
        leverage: 10,
      },
    ]);
    listBotsMock.mockResolvedValue([
      {
        id: "bot-okx",
        name: "OKX Bot",
        mode: "PAPER",
        paperStartBalance: 12_000,
        exchange: "OKX",
        marketType: "FUTURES",
        positionMode: "ONE_WAY",
        strategyId: "strat-2",
        isActive: false,
        liveOptIn: false,
        maxOpenPositions: 1,
      },
      {
        id: "bot-binance",
        name: "Binance Bot",
        mode: "PAPER",
        paperStartBalance: 10_000,
        exchange: "BINANCE",
        marketType: "FUTURES",
        positionMode: "ONE_WAY",
        strategyId: "strat-2",
        isActive: true,
        liveOptIn: false,
        maxOpenPositions: 1,
      },
    ]);

    renderWithI18n();

    await waitFor(() => {
      expect(screen.getByText("OKX Bot")).toBeInTheDocument();
      expect(screen.getByText("Binance Bot")).toBeInTheDocument();
    });

    expect(screen.getByText("PLACEHOLDER")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Szukaj botow (np. BTCUSDT)"), {
      target: { value: "okx" },
    });

    await waitFor(() => {
      expect(screen.getByText("OKX Bot")).toBeInTheDocument();
      expect(screen.queryByText("Binance Bot")).not.toBeInTheDocument();
    });
  });
});
