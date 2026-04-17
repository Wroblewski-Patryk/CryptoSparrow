import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import WalletsListTable from "./WalletsListTable";
import { I18nProvider } from "@/i18n/I18nProvider";

const deleteWalletMock = vi.hoisted(() => vi.fn());

vi.mock("../services/wallets.service", () => ({
  deleteWallet: deleteWalletMock,
}));

describe("WalletsListTable", () => {
  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  const renderTable = (onDeleted = vi.fn()) => {
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
        />
      </I18nProvider>
    );

    return { onDeleted };
  };

  it("shows expandable wallet details row", () => {
    renderTable();

    fireEvent.click(screen.getByRole("button", { name: "Details" }));

    expect(screen.getByText("Allocation mode:")).toBeInTheDocument();
    expect(screen.getByText("API key:")).toBeInTheDocument();
  });

});
