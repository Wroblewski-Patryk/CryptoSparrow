import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("Bots /:id route", () => {
  it("redirects to canonical preview route", async () => {
    const { default: BotDetailsRedirectPage } = await import("./page");

    await BotDetailsRedirectPage({
      params: Promise.resolve({ id: "bot-57" }),
    });

    expect(redirectMock).toHaveBeenCalledWith("/dashboard/bots/bot-57/preview");
  });
});
