import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BotCreateEditForm from "./BotCreateEditForm";
import { I18nProvider } from "@/i18n/I18nProvider";

const listStrategiesMock = vi.hoisted(() => vi.fn());
const listMarketUniversesMock = vi.hoisted(() => vi.fn());
const fetchApiKeysMock = vi.hoisted(() => vi.fn());
const createBotMock = vi.hoisted(() => vi.fn());
const updateBotMock = vi.hoisted(() => vi.fn());
const getBotMock = vi.hoisted(() => vi.fn());
const getBotRuntimeGraphMock = vi.hoisted(() => vi.fn());
const routerReplaceMock = vi.hoisted(() => vi.fn());
const routerPushMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplaceMock,
    push: routerPushMock,
  }),
}));

vi.mock("@/features/strategies/api/strategies.api", () => ({
  listStrategies: listStrategiesMock,
}));

vi.mock("@/features/markets/services/markets.service", () => ({
  listMarketUniverses: listMarketUniversesMock,
}));

vi.mock("@/features/profile/services/apiKeys.service", () => ({
  fetchApiKeys: fetchApiKeysMock,
}));

vi.mock("../services/bots.service", () => ({
  createBot: createBotMock,
  updateBot: updateBotMock,
  getBot: getBotMock,
  getBotRuntimeGraph: getBotRuntimeGraphMock,
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

const renderWithI18n = () => {
  window.localStorage.setItem("cryptosparrow-locale", "en");
  return render(
    <I18nProvider>
      <BotCreateEditForm />
    </I18nProvider>
  );
};

const baseApiKey = {
  id: "k1",
  label: "Main key",
  exchange: "BINANCE" as const,
  apiKey: "ab********yz",
  apiSecret: "",
  syncExternalPositions: true,
  manageExternalPositions: false,
  createdAt: "2026-04-06T10:00:00.000Z",
};

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  listStrategiesMock.mockReset();
  listMarketUniversesMock.mockReset();
  fetchApiKeysMock.mockReset();
  createBotMock.mockReset();
  updateBotMock.mockReset();
  getBotMock.mockReset();
  getBotRuntimeGraphMock.mockReset();
  routerReplaceMock.mockReset();
  routerPushMock.mockReset();
  toastErrorMock.mockReset();
  toastSuccessMock.mockReset();
});

describe("BotCreateEditForm", () => {
  it("shows LIVE API key compatibility hint for selected exchange", async () => {
    listStrategiesMock.mockResolvedValue([
      { id: "s1", name: "Momentum", interval: "5m", leverage: 2, config: {} },
    ]);
    listMarketUniversesMock.mockResolvedValue([
      {
        id: "g1",
        name: "Core Futures",
        exchange: "BINANCE",
        marketType: "FUTURES",
        baseCurrency: "USDT",
        whitelist: ["BTCUSDT"],
        blacklist: [],
      },
    ]);
    fetchApiKeysMock.mockResolvedValue([baseApiKey]);

    renderWithI18n();

    await waitFor(() => {
      expect(screen.getByLabelText("Bot mode")).toHaveValue("PAPER");
    });

    fireEvent.change(screen.getByLabelText("Bot mode"), { target: { value: "LIVE" } });

    expect(screen.getByText("LIVE API key compatibility")).toBeInTheDocument();
    expect(screen.getByText("Compatible LIVE keys found for this exchange: 1.")).toBeInTheDocument();
  });

  it("shows validation copy and blocks create when active LIVE has no compatible key", async () => {
    listStrategiesMock.mockResolvedValue([
      { id: "s2", name: "Live Strategy", interval: "15m", leverage: 2, config: {} },
    ]);
    listMarketUniversesMock.mockResolvedValue([
      {
        id: "g2",
        name: "Binance Futures",
        exchange: "BINANCE",
        marketType: "FUTURES",
        baseCurrency: "USDT",
        whitelist: ["ETHUSDT"],
        blacklist: [],
      },
    ]);
    fetchApiKeysMock.mockResolvedValue([]);

    renderWithI18n();

    await waitFor(() => {
      expect(screen.getByLabelText("Bot name")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Bot name"), { target: { value: "Live Runner" } });
    fireEvent.change(screen.getByLabelText("Bot mode"), { target: { value: "LIVE" } });
    fireEvent.click(screen.getByRole("button", { name: "Add bot" }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Add at least one compatible LIVE API key for selected exchange before activating LIVE bot."
      );
    });
    expect(createBotMock).not.toHaveBeenCalled();
  });

  it("shows placeholder activation hint and disables active toggle for unsupported exchange", async () => {
    listStrategiesMock.mockResolvedValue([
      { id: "s3", name: "Placeholder Strategy", interval: "1h", leverage: 2, config: {} },
    ]);
    listMarketUniversesMock.mockResolvedValue([
      {
        id: "g3",
        name: "OKX Futures",
        exchange: "OKX",
        marketType: "FUTURES",
        baseCurrency: "USDT",
        whitelist: ["BTCUSDT"],
        blacklist: [],
      },
    ]);
    fetchApiKeysMock.mockResolvedValue([baseApiKey]);

    renderWithI18n();

    await waitFor(() => {
      expect(screen.getByLabelText("Bot mode")).toHaveValue("PAPER");
    });

    expect(screen.getByText("PLACEHOLDER")).toBeInTheDocument();
    expect(
      screen.getByText("Placeholder exchange selected. Runtime activation for PAPER mode is not implemented yet.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Selected exchange does not support LIVE execution yet (placeholder adapter).")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Active")).toBeDisabled();
  });
});
