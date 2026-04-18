import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/i18n/I18nProvider";

import BacktestsRunsTable from "./BacktestsRunsTable";

const deleteBacktestRunMock = vi.hoisted(() => vi.fn());

vi.mock("../services/backtests.service", () => ({
  deleteBacktestRun: deleteBacktestRunMock,
}));

describe("BacktestsRunsTable", () => {
  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("uses canonical preset actions for preview and delete", async () => {
    window.localStorage.setItem("cryptosparrow-locale", "pl");
    render(
      <I18nProvider>
        <BacktestsRunsTable
          rows={[
            {
              id: "bt-1",
              strategyId: "str-1",
              name: "Run #1",
              symbol: "BTCUSDT",
              timeframe: "5m",
              status: "COMPLETED",
              startedAt: "2026-04-18T10:00:00.000Z",
              finishedAt: "2026-04-18T10:10:00.000Z",
              notes: null,
              createdAt: "2026-04-18T10:00:00.000Z",
            },
          ]}
        />
      </I18nProvider>
    );

    const previewLink = screen.getByRole("link", { name: /podglad run #1|preview run #1/i });
    const deleteButton = screen.getByRole("button", { name: /usun|delete/i });

    expect(previewLink).toHaveAttribute("href", "/dashboard/backtests/bt-1");
    expect(previewLink.className).toContain("text-base-content/75");
    expect(deleteButton.className).toContain("text-error");
  });
});
