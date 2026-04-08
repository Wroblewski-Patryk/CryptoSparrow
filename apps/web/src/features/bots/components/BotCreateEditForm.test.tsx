import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BotCreateEditForm from "./BotCreateEditForm";
import { I18nProvider } from "@/i18n/I18nProvider";

const listStrategiesMock = vi.hoisted(() => vi.fn());
const listMarketUniversesMock = vi.hoisted(() => vi.fn());
const listWalletsMock = vi.hoisted(() => vi.fn());
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

vi.mock("@/features/wallets/services/wallets.service", () => ({
  listWallets: listWalletsMock,
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

const baseWallet = {
  id: "w1",
  name: "Paper wallet",
  mode: "PAPER" as const,
  exchange: "BINANCE" as const,
  marketType: "FUTURES" as const,
  baseCurrency: "USDT",
  paperInitialBalance: 10000,
  liveAllocationMode: null,
  liveAllocationValue: null,
  apiKeyId: null,
  createdAt: "2026-04-06T10:00:00.000Z",
  updatedAt: "2026-04-06T10:00:00.000Z",
};

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  listStrategiesMock.mockReset();
  listMarketUniversesMock.mockReset();
  listWalletsMock.mockReset();
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
  it("shows LIVE mode controls when wallet is LIVE with linked API key", async () => {
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
    listWalletsMock.mockResolvedValue([
      {
        ...baseWallet,
        id: "w-live",
        mode: "LIVE",
        apiKeyId: baseApiKey.id,
      },
    ]);
    fetchApiKeysMock.mockResolvedValue([baseApiKey]);

    renderWithI18n();

    await waitFor(() => {
      expect(screen.getByText("Wallet mode:")).toBeInTheDocument();
    });
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.queryByText("Selected LIVE wallet has no linked API key.")).not.toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
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
    listWalletsMock.mockResolvedValue([
      {
        ...baseWallet,
        id: "w-live-missing-key",
        mode: "LIVE",
        apiKeyId: null,
      },
    ]);
    fetchApiKeysMock.mockResolvedValue([]);

    const { container } = renderWithI18n();

    await waitFor(() => {
      expect(screen.getByLabelText("Bot name")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Bot name"), { target: { value: "Live Runner" } });
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Selected LIVE wallet has no linked API key.");
    });
    expect(createBotMock).not.toHaveBeenCalled();
  });

  it("disables active toggle for unsupported exchange placeholder", async () => {
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
    listWalletsMock.mockResolvedValue([
      {
        ...baseWallet,
        id: "w-okx",
        exchange: "OKX",
      },
    ]);
    fetchApiKeysMock.mockResolvedValue([baseApiKey]);

    renderWithI18n();

    await waitFor(() => {
      expect(screen.getByLabelText("Bot name")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Active")).toBeDisabled();
  });
});
