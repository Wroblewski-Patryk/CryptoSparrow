import { fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.queryByText("Exchanges")).not.toBeInTheDocument();
    expect(screen.getAllByText("Bots").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Bots" })).toHaveAttribute("href", "/dashboard/bots");
    expect(screen.queryByRole("link", { name: "Create bot" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Connections" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Orders" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Positions" })).not.toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
    const dashboardLinks = screen.getAllByRole("link", { name: "Dashboard" });
    const desktopDashboardLink = dashboardLinks.find((item) => item.getAttribute("href") === "/dashboard");
    expect(desktopDashboardLink).toBeTruthy();
    expect(desktopDashboardLink?.className).toContain("focus-visible:outline");
    const marketsLinks = screen.getAllByRole("link", { name: "Markets" });
    expect(marketsLinks.some((item) => item.className.includes("!text-primary"))).toBe(true);
    const nav = screen.getByRole("navigation", { name: "Dashboard navigation" });
    expect(nav.className).toContain("justify-center");
  });

  it("opens and closes mobile menu overlay with scroll lock side effects", () => {
    render(
      <I18nProvider>
        <Header />
      </I18nProvider>
    );

    const menuButton = screen.getByRole("button", { name: "Menu" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    const mobileNav = document.getElementById("dashboard-mobile-nav");
    expect(mobileNav).toBeInTheDocument();
    expect(mobileNav?.className).toContain("overflow-y-auto");
    expect(screen.queryByRole("link", { name: "Orders" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Positions" })).not.toBeInTheDocument();
    const overlay = mobileNav?.parentElement;
    expect(overlay?.className ?? "").toContain("overflow-hidden");
    expect(overlay?.style.top).toBe("72px");
    expect(overlay?.style.height).toBe("calc(100dvh - 72px)");
    expect(overlay?.style.maxHeight).toBe("calc(100dvh - 72px)");
    expect(overlay?.style.minHeight).toBe("calc(100vh - 72px)");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.touchAction).toBe("none");
    expect(document.body.style.overscrollBehavior).toBe("none");

    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("dashboard-mobile-nav")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.touchAction || "").toBe("");
    expect(document.body.style.overscrollBehavior || "").toBe("");
  });
});
