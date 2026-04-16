import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DashboardPage from "./page";
import BotsPage from "./bots/page";
import WalletsListPage from "./wallets/list/page";
import { I18nProvider } from "@/i18n/I18nProvider";

const listWalletsMock = vi.hoisted(() => vi.fn());

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "qa@cryptosparrow.dev", userId: "user-1", role: "USER" },
    loading: false,
  }),
}));

vi.mock("@/features/dashboard-home/components/HomeLiveWidgets", () => ({
  default: () => (
    <section aria-label="Runtime widgets">
      <button type="button">Refresh runtime</button>
    </section>
  ),
}));

vi.mock("@/features/bots/components/BotsListTable", () => ({
  default: () => <div data-testid="bots-list-table">bots-table</div>,
}));

vi.mock("@/features/wallets/components/WalletsListTable", () => ({
  default: ({ rows }: { rows: Array<{ id: string }> }) => (
    <div data-testid="wallets-list-table">{rows.length}</div>
  ),
}));

vi.mock("@/features/wallets/services/wallets.service", () => ({
  listWallets: listWalletsMock,
}));

const renderWithI18n = (node: ReactNode) => {
  window.localStorage.setItem("cryptosparrow-locale", "en");
  return render(<I18nProvider>{node}</I18nProvider>);
};

const expectNamedInteractiveControls = () => {
  const controls = [...screen.queryAllByRole("button"), ...screen.queryAllByRole("link")];
  controls.forEach((control) => {
    expect(control).toHaveAccessibleName();
  });
};

describe("Dashboard core routes accessibility smoke", () => {
  afterEach(() => {
    listWalletsMock.mockReset();
    window.localStorage.clear();
  });

  it("keeps dashboard home route semantically navigable", () => {
    renderWithI18n(<DashboardPage />);

    expect(screen.getByRole("navigation", { name: "Breadcrumb navigation" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Runtime widgets" })).toBeInTheDocument();
    expectNamedInteractiveControls();
  });

  it("keeps bots route create action accessible with contextual description", () => {
    renderWithI18n(<BotsPage />);

    expect(screen.getByRole("navigation", { name: "Breadcrumb navigation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Bots" })).toBeInTheDocument();
    const createButton = screen.getByRole("button", { name: "Create" });
    const descriptionId = createButton.getAttribute("aria-describedby");
    expect(descriptionId).toBeTruthy();
    const descriptionText = descriptionId ? document.getElementById(descriptionId)?.textContent : "";
    expect(descriptionText ?? "").toContain("Create");
    expect(descriptionText ?? "").toContain("Bots");
    expectNamedInteractiveControls();
  });

  it("keeps wallets list route a11y-safe in empty state", async () => {
    listWalletsMock.mockResolvedValue([]);

    renderWithI18n(<WalletsListPage />);

    await waitFor(() => {
      expect(listWalletsMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole("navigation", { name: "Breadcrumb navigation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Wallets" })).toBeInTheDocument();
    expect(screen.getByText("No wallets")).toBeInTheDocument();
    const createButton = screen.getByRole("button", { name: "Create" });
    const descriptionId = createButton.getAttribute("aria-describedby");
    expect(descriptionId).toBeTruthy();
    const descriptionText = descriptionId ? document.getElementById(descriptionId)?.textContent : "";
    expect(descriptionText ?? "").toContain("Create");
    expect(descriptionText ?? "").toContain("Wallets");
    expectNamedInteractiveControls();
  });
});
