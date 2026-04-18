import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
import MarketUniversesTable from "./MarketUniversesTable";

const pushMock = vi.hoisted(() => vi.fn());
const createMarketUniverseMock = vi.hoisted(() => vi.fn());
const deleteMarketUniverseMock = vi.hoisted(() => vi.fn());
const fetchMarketCatalogMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("../services/markets.service", () => ({
  createMarketUniverse: createMarketUniverseMock,
  deleteMarketUniverse: deleteMarketUniverseMock,
  fetchMarketCatalog: fetchMarketCatalogMock,
}));

describe("MarketUniversesTable", () => {
  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("clones market entry using create contract payload with clone-marked name", async () => {
    window.localStorage.setItem("cryptosparrow-locale", "en");
    fetchMarketCatalogMock.mockResolvedValue({
      source: "BINANCE",
      exchange: "BINANCE",
      marketType: "FUTURES",
      baseCurrency: "USDT",
      baseCurrencies: ["USDT"],
      totalAvailable: 2,
      totalForBaseCurrency: 2,
      markets: [
        { symbol: "BTCUSDT", displaySymbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT", quoteVolume24h: 1000000, lastPrice: 65000 },
        { symbol: "ETHUSDT", displaySymbol: "ETHUSDT", baseAsset: "ETH", quoteAsset: "USDT", quoteVolume24h: 800000, lastPrice: 3200 },
      ],
    });
    createMarketUniverseMock.mockResolvedValue({
      id: "mu-clone-1",
      name: "Trend Set (clone)",
      exchange: "BINANCE",
      marketType: "FUTURES",
      baseCurrency: "USDT",
      filterRules: { minQuoteVolumeEnabled: true, minQuoteVolume24h: 500000 },
      whitelist: ["BTCUSDT"],
      blacklist: ["ETHUSDT"],
    });

    const onCloned = vi.fn();

    render(
      <I18nProvider>
        <MarketUniversesTable
          rows={[
            {
              id: "mu-1",
              name: "Trend Set",
              exchange: "BINANCE",
              marketType: "FUTURES",
              baseCurrency: "USDT",
              filterRules: { minQuoteVolumeEnabled: true, minQuoteVolume24h: 500000 },
              whitelist: ["BTCUSDT"],
              blacklist: ["ETHUSDT"],
              createdAt: "2026-04-17T10:00:00.000Z",
            },
          ]}
          onDeleted={vi.fn()}
          onCloned={onCloned}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Clone" }));

    await waitFor(() => {
      expect(createMarketUniverseMock).toHaveBeenCalledWith({
        name: "Trend Set (clone)",
        exchange: "BINANCE",
        marketType: "FUTURES",
        baseCurrency: "USDT",
        filterRules: { minQuoteVolumeEnabled: true, minQuoteVolume24h: 500000 },
        whitelist: ["BTCUSDT"],
        blacklist: ["ETHUSDT"],
      });
      expect(onCloned).toHaveBeenCalledWith(
        expect.objectContaining({ id: "mu-clone-1", name: "Trend Set (clone)" })
      );
    });
  });
});
