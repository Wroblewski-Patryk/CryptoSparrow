import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardRouteProgress from "./DashboardRouteProgress";

const navState = vi.hoisted(() => ({
  pathname: "/dashboard",
  search: "",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navState.pathname,
  useSearchParams: () => new URLSearchParams(navState.search.replace(/^\?/, "")),
}));

const getOuterBar = (container: HTMLElement) => container.querySelector('[aria-hidden="true"]') as HTMLDivElement;

describe("DashboardRouteProgress", () => {
  beforeEach(() => {
    navState.pathname = "/dashboard";
    navState.search = "";
    window.history.replaceState({}, "", "/dashboard");
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (vi.isFakeTimers()) {
      vi.runOnlyPendingTimers();
    }
    vi.useRealTimers();
  });

  it("starts on internal navigation click and hides after route change completion", () => {
    const { container, rerender } = render(<DashboardRouteProgress />);
    const outer = getOuterBar(container);
    const fill = outer.firstElementChild as HTMLDivElement;

    expect(outer.className).toContain("opacity-0");
    expect(fill.style.width).toBe("0%");

    const link = document.createElement("a");
    link.href = "/dashboard/markets/list";
    link.addEventListener("click", (event) => event.preventDefault());
    document.body.appendChild(link);

    act(() => {
      fireEvent.click(link);
    });
    expect(outer.className).toContain("opacity-100");

    navState.pathname = "/dashboard/markets/list";
    rerender(<DashboardRouteProgress />);

    act(() => {
      vi.advanceTimersByTime(240);
    });
    expect(outer.className).toContain("opacity-0");
    expect(fill.style.width).toBe("0%");
  });

  it("ignores hash-only anchor clicks", () => {
    const { container } = render(<DashboardRouteProgress />);
    const outer = getOuterBar(container);

    const link = document.createElement("a");
    link.href = "#section";
    document.body.appendChild(link);

    fireEvent.click(link);
    expect(outer.className).toContain("opacity-0");
  });

  it("ignores popstate when only hash changed", () => {
    const { container } = render(<DashboardRouteProgress />);
    const outer = getOuterBar(container);

    window.history.pushState({}, "", "/dashboard#details");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(outer.className).toContain("opacity-0");
  });
});
