import { describe, expect, it } from "vitest";
import { resolveFallbackTtpProtectedPercent } from "./trailingStopDisplay";

describe("trailingStopDisplay", () => {
  it("arms and keeps sticky protected percent for TTP fallback", () => {
    const sticky = new Map<string, number>();
    const levels = [
      { armPercent: 5, trailPercent: 2.5 },
      { armPercent: 10, trailPercent: 5 },
      { armPercent: 20, trailPercent: 10 },
    ];

    const first = resolveFallbackTtpProtectedPercent({
      positionId: "pos-1",
      livePnlPercent: 6.21,
      trailingTakeProfitLevels: levels,
      stickyFavorableMoveByPosition: sticky,
    });
    expect(first).toBeCloseTo(3.71, 2);

    const second = resolveFallbackTtpProtectedPercent({
      positionId: "pos-1",
      livePnlPercent: 4.1,
      trailingTakeProfitLevels: levels,
      stickyFavorableMoveByPosition: sticky,
    });
    expect(second).toBeCloseTo(3.71, 2);

    const third = resolveFallbackTtpProtectedPercent({
      positionId: "pos-1",
      livePnlPercent: 12,
      trailingTakeProfitLevels: levels,
      stickyFavorableMoveByPosition: sticky,
    });
    expect(third).toBeCloseTo(7, 2);
  });

  it("handles decimal strategy levels from API payload (0.05 = 5%)", () => {
    const sticky = new Map<string, number>();
    const levels = [{ armPercent: 0.05, trailPercent: 0.025 }];

    const value = resolveFallbackTtpProtectedPercent({
      positionId: "pos-2",
      livePnlPercent: 6.21,
      trailingTakeProfitLevels: levels,
      stickyFavorableMoveByPosition: sticky,
    });

    expect(value).toBeCloseTo(3.71, 2);
  });

  it("disarms fallback when live pnl% drops below first TTP floor", () => {
    const sticky = new Map<string, number>();
    const levels = [{ armPercent: 5, trailPercent: 2.5 }];

    const armed = resolveFallbackTtpProtectedPercent({
      positionId: "pos-3",
      livePnlPercent: 6.21,
      trailingTakeProfitLevels: levels,
      stickyFavorableMoveByPosition: sticky,
    });
    expect(armed).toBeCloseTo(3.71, 2);

    const disarmed = resolveFallbackTtpProtectedPercent({
      positionId: "pos-3",
      livePnlPercent: 1.78,
      trailingTakeProfitLevels: levels,
      stickyFavorableMoveByPosition: sticky,
    });
    expect(disarmed).toBeNull();
    expect(sticky.has("pos-3")).toBe(false);

    const rearmed = resolveFallbackTtpProtectedPercent({
      positionId: "pos-3",
      livePnlPercent: 5.4,
      trailingTakeProfitLevels: levels,
      stickyFavorableMoveByPosition: sticky,
    });
    expect(rearmed).toBeCloseTo(2.9, 2);
  });
});
