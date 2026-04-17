import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider, useI18n } from "./I18nProvider";

function RouteScopeProbe() {
  const { locale, setLocale, t } = useI18n();
  const key = window.location.pathname.startsWith("/dashboard/markets")
    ? "dashboard.markets.title"
    : "dashboard.backtests.listLabel";

  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="value">{t(key)}</span>
      <button type="button" onClick={() => setLocale("pt")}>set-pt</button>
    </div>
  );
}

describe("I18nProvider route loading", () => {
  beforeEach(() => {
    window.localStorage.removeItem("cryptosparrow-locale");
    window.localStorage.removeItem("cryptosparrow-timezone");
    act(() => {
      window.history.replaceState({}, "", "/dashboard/backtests/list");
    });
  });

  it("updates route-scoped namespace dictionary on route transitions without key flicker", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <I18nProvider>
        <RouteScopeProbe />
      </I18nProvider>
    );

    expect(screen.getByTestId("value")).toHaveTextContent("List");

    act(() => {
      window.history.pushState({}, "", "/dashboard/markets/list");
    });

    await waitFor(() => {
      expect(screen.getByTestId("value")).toHaveTextContent("Markets");
    });

    expect(screen.getByTestId("value").textContent ?? "").not.toContain("dashboard.");
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("keeps locale persistence stable across route refresh-style remount", async () => {
    act(() => {
      window.history.replaceState({}, "", "/dashboard/markets/list");
    });

    const first = render(
      <I18nProvider>
        <RouteScopeProbe />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "set-pt" }));

    await waitFor(() => {
      expect(screen.getByTestId("locale")).toHaveTextContent("pt");
      expect(screen.getByTestId("value")).toHaveTextContent("Mercados");
      expect(window.localStorage.getItem("cryptosparrow-locale")).toBe("pt");
    });

    first.unmount();

    render(
      <I18nProvider>
        <RouteScopeProbe />
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("locale")).toHaveTextContent("pt");
      expect(screen.getByTestId("value")).toHaveTextContent("Mercados");
    });
  });
});
