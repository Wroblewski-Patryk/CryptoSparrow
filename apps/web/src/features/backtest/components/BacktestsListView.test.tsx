import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BacktestsListView from "./BacktestsListView";
import { I18nProvider } from "@/i18n/I18nProvider";

const listBacktestRunsMock = vi.hoisted(() => vi.fn());

vi.mock("../services/backtests.service", () => ({
  listBacktestRuns: listBacktestRunsMock,
}));

describe("BacktestsListView loading UX", () => {
  afterEach(() => {
    window.localStorage.removeItem("cryptosparrow-locale");
  });

  it("renders skeleton composition while runs list is loading", () => {
    listBacktestRunsMock.mockReturnValue(new Promise(() => undefined));

    render(<BacktestsListView />);

    expect(screen.getByLabelText("Loading KPI row")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading table rows")).toBeInTheDocument();
  });

  it("renders Portuguese empty-state copy when locale is set to pt", async () => {
    window.localStorage.setItem("cryptosparrow-locale", "pt");
    listBacktestRunsMock.mockResolvedValue([]);

    render(
      <I18nProvider>
        <BacktestsListView />
      </I18nProvider>
    );

    expect(await screen.findByText("Sem execucoes de backtest")).toBeInTheDocument();
    expect(screen.getByText("Cria a primeira execucao para consultar resultados.")).toBeInTheDocument();
  });
});
