import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Header from "./Header";
import { I18nProvider } from "../../../i18n/I18nProvider";

vi.mock("../../components/ProfileButton", () => ({
  default: () => <button type="button">Profile</button>,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/markets/list",
}));

describe("Header responsive smoke", () => {
  it("renders navigation landmark with compact menu structure", () => {
    render(
      <I18nProvider>
        <Header />
      </I18nProvider>
    );

    expect(screen.getByRole("navigation", { name: "Dashboard navigation" })).toBeInTheDocument();
    expect(screen.getAllByText("Markets").length).toBeGreaterThan(0);
    expect(screen.getByText("Exchanges")).toBeInTheDocument();
    expect(screen.getAllByText("Bots").length).toBeGreaterThan(0);
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
    const dashboardLinks = screen.getAllByRole("link", { name: "Dashboard" });
    const desktopDashboardLink = dashboardLinks.find((item) => item.getAttribute("href") === "/dashboard");
    expect(desktopDashboardLink).toBeTruthy();
    expect(desktopDashboardLink?.className).toContain("focus-visible:outline");
    const marketsLabels = screen.getAllByText("Markets");
    expect(marketsLabels.some((item) => item.className.includes("font-semibold"))).toBe(true);
    const nav = screen.getByRole("navigation", { name: "Dashboard navigation" });
    expect(nav.className).toContain("justify-center");
  });
});
