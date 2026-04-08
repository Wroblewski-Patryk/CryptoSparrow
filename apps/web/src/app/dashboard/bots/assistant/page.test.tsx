import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("Bots legacy /assistant route", () => {
  it("redirects to canonical assistant route when botId query is provided", async () => {
    const { default: BotsAssistantPage } = await import("./page");

    await BotsAssistantPage({
      searchParams: Promise.resolve({ botId: "bot-56" }),
    });

    expect(redirectMock).toHaveBeenCalledWith("/dashboard/bots/bot-56/assistant");
  });

  it("redirects to bots list when botId query is missing", async () => {
    const { default: BotsAssistantPage } = await import("./page");

    await BotsAssistantPage({
      searchParams: Promise.resolve({}),
    });

    expect(redirectMock).toHaveBeenCalledWith("/dashboard/bots");
  });
});
