import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("Bots legacy /runtime route", () => {
  it("redirects to canonical preview route when botId query is provided", async () => {
    const { default: BotsRuntimePage } = await import("./page");

    await BotsRuntimePage({
      searchParams: Promise.resolve({ botId: "bot-55" }),
    });

    expect(redirectMock).toHaveBeenCalledWith("/dashboard/bots/bot-55/preview");
  });

  it("redirects to bots list when botId query is missing", async () => {
    const { default: BotsRuntimePage } = await import("./page");

    await BotsRuntimePage({
      searchParams: Promise.resolve({}),
    });

    expect(redirectMock).toHaveBeenCalledWith("/dashboard/bots");
  });
});
