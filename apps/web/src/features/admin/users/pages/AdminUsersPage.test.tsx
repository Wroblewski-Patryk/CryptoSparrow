import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminUsersPage from "./AdminUsersPage";
import { I18nProvider } from "@/i18n/I18nProvider";

const getAdminUsersMock = vi.hoisted(() => vi.fn());
const updateAdminUserMock = vi.hoisted(() => vi.fn());
const getAdminSubscriptionPlansMock = vi.hoisted(() => vi.fn());

vi.mock("../services/adminUsers.service", () => ({
  getAdminUsers: getAdminUsersMock,
  updateAdminUser: updateAdminUserMock,
}));

vi.mock("../../subscriptions/services/adminSubscriptionPlan.service", () => ({
  getAdminSubscriptionPlans: getAdminSubscriptionPlansMock,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "owner@example.com", userId: "admin-1" },
    logout: vi.fn(),
    loading: false,
    refetchUser: vi.fn(),
  }),
}));

const baseUser = {
  id: "user-1",
  email: "user@example.com",
  name: "Regular User",
  role: "USER" as const,
  createdAt: "2026-04-07T00:00:00.000Z",
  updatedAt: "2026-04-07T00:00:00.000Z",
  activeSubscription: {
    planCode: "FREE" as const,
    planDisplayName: "Free",
    source: "DEFAULT" as const,
    startsAt: "2026-04-07T00:00:00.000Z",
    endsAt: null,
  },
};

const advancedPlan = {
  code: "ADVANCED" as const,
  slug: "advanced",
  displayName: "Advanced",
  sortOrder: 2,
  isActive: true,
  monthlyPriceMinor: 4900,
  currency: "USD",
  updatedAt: "2026-04-07T00:00:00.000Z",
  entitlements: {
    version: 1,
    limits: {
      maxBotsTotal: 3,
      maxBotsByMode: {
        PAPER: 3,
        LIVE: 3,
      },
      maxConcurrentBacktests: 3,
    },
    features: {
      liveTrading: true,
      syncExternalPositions: true,
      manageExternalPositions: true,
    },
    cadence: {
      allowedIntervals: ["1m", "5m"],
      defaultMarketScanInterval: "5m",
      defaultPositionScanInterval: "5m",
    },
  },
};

const freePlan = {
  ...advancedPlan,
  code: "FREE" as const,
  slug: "free",
  displayName: "Free",
  sortOrder: 1,
  monthlyPriceMinor: 0,
  entitlements: {
    ...advancedPlan.entitlements,
    limits: {
      ...advancedPlan.entitlements.limits,
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
  },
};

describe("AdminUsersPage", () => {
  const renderWithI18n = () => {
    window.history.pushState({}, "", "/admin/users");
    return render(
      <I18nProvider>
        <AdminUsersPage />
      </I18nProvider>
    );
  };

  beforeEach(() => {
    getAdminUsersMock.mockReset();
    updateAdminUserMock.mockReset();
    getAdminSubscriptionPlansMock.mockReset();
  });

  it("loads users and updates role", async () => {
    getAdminUsersMock.mockResolvedValue({
      users: [baseUser],
      meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    });
    getAdminSubscriptionPlansMock.mockResolvedValue([freePlan, advancedPlan]);
    updateAdminUserMock.mockResolvedValue({
      ...baseUser,
      role: "ADMIN",
    });

    renderWithI18n();

    expect(await screen.findByText("user@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Toggle role for user@example.com"));

    await waitFor(() => {
      expect(updateAdminUserMock).toHaveBeenCalledWith("user-1", { role: "ADMIN" });
    });
    expect(screen.getByText("ADMIN", { selector: "span.badge" })).toBeInTheDocument();
  });

  it("assigns selected plan for user", async () => {
    getAdminUsersMock.mockResolvedValue({
      users: [baseUser],
      meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    });
    getAdminSubscriptionPlansMock.mockResolvedValue([freePlan, advancedPlan]);
    updateAdminUserMock.mockResolvedValue({
      ...baseUser,
      activeSubscription: {
        ...baseUser.activeSubscription,
        planCode: "ADVANCED",
        planDisplayName: "Advanced",
        source: "ADMIN_OVERRIDE",
      },
    });

    renderWithI18n();

    expect(await screen.findByText("user@example.com")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Plan select for user@example.com"), {
      target: { value: "ADVANCED" },
    });
    fireEvent.click(screen.getByLabelText("Assign plan for user@example.com"));

    await waitFor(() => {
      expect(updateAdminUserMock).toHaveBeenCalledWith("user-1", {
        subscriptionPlanCode: "ADVANCED",
      });
    });
    expect(await screen.findByText("Advanced")).toBeInTheDocument();
  });

  it("shows error alert when users load fails", async () => {
    getAdminUsersMock.mockRejectedValue(new Error("boom"));
    getAdminSubscriptionPlansMock.mockResolvedValue([freePlan, advancedPlan]);

    renderWithI18n();

    expect(await screen.findByText("Could not load users.")).toBeInTheDocument();
  });
});
