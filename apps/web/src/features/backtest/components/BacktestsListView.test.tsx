import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BacktestsListView from "./BacktestsListView";

const listBacktestRunsMock = vi.hoisted(() => vi.fn());

vi.mock("../services/backtests.service", () => ({
  listBacktestRuns: listBacktestRunsMock,
}));

describe("BacktestsListView loading UX", () => {
  it("renders skeleton composition while runs list is loading", () => {
    listBacktestRunsMock.mockReturnValue(new Promise(() => undefined));

    render(<BacktestsListView />);

    expect(screen.getByLabelText("Loading KPI row")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading table rows")).toBeInTheDocument();
  });
});

