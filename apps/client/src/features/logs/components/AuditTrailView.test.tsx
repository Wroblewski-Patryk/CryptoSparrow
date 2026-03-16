import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AuditTrailView from "./AuditTrailView";
import { I18nProvider } from "../../../i18n/I18nProvider";

const listLogsMock = vi.hoisted(() => vi.fn());

vi.mock("../services/logs.service", () => ({
  listLogs: listLogsMock,
}));

describe("AuditTrailView", () => {
  it("renders empty state when all sources are empty", async () => {
    listLogsMock.mockResolvedValue([]);

    render(
      <I18nProvider>
        <AuditTrailView />
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("No audit trail events")).toBeInTheDocument();
    });
  });

  it("renders entries and filters by source", async () => {
    listLogsMock.mockResolvedValue([
      {
        id: "l1",
        source: "engine.pre-trade",
        level: "INFO",
        action: "trade.precheck.allowed",
        message: "Allowed",
        category: "TRADING_DECISION",
        actor: "bot-runner",
        occurredAt: "2026-03-16T10:00:00.000Z",
      },
    ]);

    render(
      <I18nProvider>
        <AuditTrailView />
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Audit trail loaded")).toBeInTheDocument();
      expect(screen.getByText(/trade.precheck.allowed/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Severity filter"), {
      target: { value: "WARN" },
    });

    await waitFor(() => {
      expect(listLogsMock).toHaveBeenCalledWith(expect.objectContaining({ severity: "WARN" }));
    });
  });
});
