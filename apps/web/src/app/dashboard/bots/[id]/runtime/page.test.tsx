import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("Bots /:id/runtime route", () => {
  it("redirects to canonical preview route", async () => {
    const { default: BotRuntimeRedirectPage } = await import("./page");

    await BotRuntimeRedirectPage({
      params: Promise.resolve({ id: "bot-58" }),
    });

    expect(redirectMock).toHaveBeenCalledWith("/dashboard/bots/bot-58/preview");
  });
});
