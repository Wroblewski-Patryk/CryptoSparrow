import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminSubscriptionsPage from "./AdminSubscriptionsPage";

const getAdminSubscriptionPlansMock = vi.hoisted(() => vi.fn());
const updateAdminSubscriptionPlanMock = vi.hoisted(() => vi.fn());

vi.mock("../services/adminSubscriptionPlan.service", () => ({
  getAdminSubscriptionPlans: getAdminSubscriptionPlansMock,
  updateAdminSubscriptionPlan: updateAdminSubscriptionPlanMock,
}));

const freePlan = {
  code: "FREE" as const,
  slug: "free",
  displayName: "Free",
  sortOrder: 1,
  isActive: true,
  monthlyPriceMinor: 0,
  currency: "USD",
  updatedAt: "2026-04-07T00:00:00.000Z",
  entitlements: {
    version: 1,
    limits: {
      maxBotsTotal: 1,
      maxBotsByMode: {
        PAPER: 1,
        LIVE: 0,
      },
      maxConcurrentBacktests: 1,
    },
    features: {
      liveTrading: false,
      syncExternalPositions: true,
      manageExternalPositions: false,
    },
    cadence: {
      allowedIntervals: ["5m", "15m"],
      defaultMarketScanInterval: "5m",
      defaultPositionScanInterval: "5m",
    },
  },
};

describe("AdminSubscriptionsPage", () => {
  beforeEach(() => {
    getAdminSubscriptionPlansMock.mockReset();
    updateAdminSubscriptionPlanMock.mockReset();
  });

  it("loads plans and submits edited limits via modal", async () => {
    getAdminSubscriptionPlansMock.mockResolvedValue([freePlan]);
    updateAdminSubscriptionPlanMock.mockResolvedValue({
      ...freePlan,
      monthlyPriceMinor: 700,
      entitlements: {
        ...freePlan.entitlements,
        limits: {
          ...freePlan.entitlements.limits,
          maxBotsTotal: 2,
          maxBotsByMode: {
            PAPER: 2,
            LIVE: 0,
          },
        },
      },
    });

    render(<AdminSubscriptionsPage />);

    expect(await screen.findByText("Free")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const priceInput = screen.getByRole("spinbutton", {
      name: "Monthly price (minor units)",
      hidden: true,
    });
    const totalBotsInput = screen.getByRole("spinbutton", {
      name: "Max bots total",
      hidden: true,
    });
    const paperBotsInput = screen.getByRole("spinbutton", {
      name: "PAPER bots limit",
      hidden: true,
    });
    fireEvent.change(priceInput, { target: { value: "700" } });
    fireEvent.change(totalBotsInput, { target: { value: "2" } });
    fireEvent.change(paperBotsInput, { target: { value: "2" } });

    fireEvent.click(screen.getByRole("button", { name: "Save", hidden: true }));

    await waitFor(() => {
      expect(updateAdminSubscriptionPlanMock).toHaveBeenCalledWith(
        "FREE",
        expect.objectContaining({
          monthlyPriceMinor: 700,
          currency: "USD",
        }),
      );
    });

    expect(await screen.findByText("$7.00")).toBeInTheDocument();
  });

  it("shows error alert when loading plans fails", async () => {
    getAdminSubscriptionPlansMock.mockRejectedValue(new Error("boom"));

    render(<AdminSubscriptionsPage />);

    expect(await screen.findByText("Could not load subscription plans.")).toBeInTheDocument();
  });
});
