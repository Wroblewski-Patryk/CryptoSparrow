import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import WalletsListTable from "./WalletsListTable";
import { I18nProvider } from "@/i18n/I18nProvider";

const deleteWalletMock = vi.hoisted(() => vi.fn());
const createWalletMock = vi.hoisted(() => vi.fn());

vi.mock("../services/wallets.service", () => ({
  deleteWallet: deleteWalletMock,
  createWallet: createWalletMock,
}));

describe("WalletsListTable", () => {
  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  const renderTable = (onDeleted = vi.fn(), onCloned = vi.fn()) => {
    window.localStorage.setItem("cryptosparrow-locale", "en");
    render(
      <I18nProvider>
        <WalletsListTable
          rows={[
            {
              id: "wallet-1",
              name: "Main wallet",
              mode: "LIVE",
              exchange: "BINANCE",
              marketType: "FUTURES",
              baseCurrency: "USDT",
              paperInitialBalance: 0,
              liveAllocationMode: "PERCENT",
              liveAllocationValue: 25,
              apiKeyId: "key-1",
            },
          ]}
          onDeleted={onDeleted}
          onCloned={onCloned}
        />
      </I18nProvider>
    );

    return { onDeleted, onCloned };
  };

  it("shows expandable wallet details row", () => {
    renderTable();

    fireEvent.click(screen.getByRole("button", { name: "Details" }));

    expect(screen.getByText("Allocation mode:")).toBeInTheDocument();
    expect(screen.getByText("API key:")).toBeInTheDocument();
  });

  it("clones wallet using create contract payload and appends clone-marked name", async () => {
    const onCloned = vi.fn();
    createWalletMock.mockResolvedValue({
      id: "wallet-clone-1",
      name: "Main wallet (clone)",
      mode: "LIVE",
      exchange: "BINANCE",
      marketType: "FUTURES",
      baseCurrency: "USDT",
      paperInitialBalance: 0,
      liveAllocationMode: "PERCENT",
      liveAllocationValue: 25,
      apiKeyId: "key-1",
    });

    renderTable(vi.fn(), onCloned);

    fireEvent.click(screen.getByRole("button", { name: "Clone" }));

    await waitFor(() => {
      expect(createWalletMock).toHaveBeenCalledWith({
        name: "Main wallet (clone)",
        mode: "LIVE",
        exchange: "BINANCE",
        marketType: "FUTURES",
        baseCurrency: "USDT",
        paperInitialBalance: 0,
        liveAllocationMode: "PERCENT",
        liveAllocationValue: 25,
        apiKeyId: "key-1",
      });
      expect(onCloned).toHaveBeenCalledWith(
        expect.objectContaining({ id: "wallet-clone-1", name: "Main wallet (clone)" })
      );
    });
  });

});
