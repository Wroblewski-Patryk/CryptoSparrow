import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../../i18n/I18nProvider";
import SubscriptionPanel from "./Subscription";

const getProfileSubscriptionMock = vi.hoisted(() => vi.fn());

vi.mock("../services/subscription.service", () => ({
  getProfileSubscription: getProfileSubscriptionMock,
}));

describe("SubscriptionPanel", () => {
  it("renders catalog and highlights active plan", async () => {
    getProfileSubscriptionMock.mockResolvedValue({
      activePlanCode: "ADVANCED",
      activeSubscription: {
        id: "sub_1",
        planCode: "ADVANCED",
        planDisplayName: "Advanced",
        status: "ACTIVE",
        source: "DEFAULT",
        autoRenew: true,
        startsAt: "2026-04-07T00:00:00.000Z",
        endsAt: null,
      },
      catalog: [
        {
          code: "FREE",
          slug: "free",
          displayName: "Free",
          sortOrder: 1,
          isActive: true,
          priceMonthlyMinor: 0,
          currency: "USD",
          entitlements: { limits: { maxBotsTotal: 1, maxBotsByMode: { PAPER: 1, LIVE: 0 } } },
        },
        {
          code: "ADVANCED",
          slug: "advanced",
          displayName: "Advanced",
          sortOrder: 2,
          isActive: true,
          priceMonthlyMinor: 4900,
          currency: "USD",
          entitlements: { limits: { maxBotsTotal: 3, maxBotsByMode: { PAPER: 3, LIVE: 3 } }, features: { liveTrading: true } },
        },
      ],
    });

    render(
      <I18nProvider>
        <SubscriptionPanel />
      </I18nProvider>
    );

    const advancedNodes = await screen.findAllByText("Advanced");
    expect(advancedNodes.length).toBeGreaterThan(0);
    expect(screen.getAllByText("Free").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Active plan").length).toBeGreaterThan(0);
  });

  it("shows retry on loading error", async () => {
    getProfileSubscriptionMock.mockRejectedValueOnce(new Error("boom"));
    getProfileSubscriptionMock.mockResolvedValueOnce({
      activePlanCode: "FREE",
      activeSubscription: null,
      catalog: [],
    });

    render(
      <I18nProvider>
        <SubscriptionPanel />
      </I18nProvider>
    );

    expect(await screen.findByText("Could not load subscription.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(getProfileSubscriptionMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
