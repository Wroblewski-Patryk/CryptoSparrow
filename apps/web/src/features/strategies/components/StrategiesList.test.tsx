import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
import StrategiesList from "./StrategiesList";

const pushMock = vi.hoisted(() => vi.fn());
const listStrategiesMock = vi.hoisted(() => vi.fn());
const createStrategyMock = vi.hoisted(() => vi.fn());
const deleteStrategyMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("../api/strategies.api", () => ({
  listStrategies: listStrategiesMock,
  createStrategy: createStrategyMock,
  deleteStrategy: deleteStrategyMock,
}));

describe("StrategiesList", () => {
  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("clones strategy with deterministic clone name and create payload", async () => {
    window.localStorage.setItem("cryptosparrow-locale", "en");
    listStrategiesMock.mockResolvedValue([
      {
        id: "str-1",
        name: "Trend Strategy",
        description: "main",
        leverage: 10,
        interval: "5m",
        walletRisk: 2,
        createdAt: "2026-04-18T10:00:00.000Z",
        config: {
          open: { direction: "both", indicatorsLong: [], indicatorsShort: [] },
          close: { mode: "basic", tp: 3, sl: 2, ttp: [], tsl: [] },
          additional: {
            dcaEnabled: false,
            dcaMode: "basic",
            dcaTimes: 0,
            dcaMultiplier: 1,
            dcaLevels: [],
            maxPositions: 1,
            maxOrders: 1,
            positionLifetime: 1,
            positionUnit: "h",
            orderLifetime: 1,
            orderUnit: "h",
            marginMode: "CROSSED",
          },
        },
      },
    ]);
    createStrategyMock.mockResolvedValue({
      id: "str-1-clone",
      name: "Trend Strategy (clone)",
      description: "main",
      leverage: 10,
      interval: "5m",
      walletRisk: 2,
      createdAt: "2026-04-18T10:00:00.000Z",
      config: {},
    });

    render(
      <I18nProvider>
        <StrategiesList />
      </I18nProvider>
    );

    const cloneButton = await screen.findByRole("button", { name: "Clone" });
    fireEvent.click(cloneButton);

    await waitFor(() => {
      expect(createStrategyMock).toHaveBeenCalledTimes(1);
      expect(createStrategyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Trend Strategy (clone)",
          interval: "5m",
          leverage: 10,
          walletRisk: 2,
        })
      );
    });
  });
});
