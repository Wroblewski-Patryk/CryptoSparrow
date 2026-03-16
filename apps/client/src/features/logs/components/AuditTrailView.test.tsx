import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AuditTrailView from "./AuditTrailView";

const listLogsMock = vi.hoisted(() => vi.fn());

vi.mock("../services/logs.service", () => ({
  listLogs: listLogsMock,
}));

describe("AuditTrailView", () => {
  it("renders empty state when all sources are empty", async () => {
    listLogsMock.mockResolvedValue([]);

    render(<AuditTrailView />);

    await waitFor(() => {
      expect(screen.getByText("Brak zdarzen audit trail")).toBeInTheDocument();
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

    render(<AuditTrailView />);

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
