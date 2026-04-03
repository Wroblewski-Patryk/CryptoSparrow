import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("Bots legacy /new route", () => {
  it("redirects to canonical create route", async () => {
    const { default: BotsLegacyCreateRedirectPage } = await import("./page");

    BotsLegacyCreateRedirectPage();

    expect(redirectMock).toHaveBeenCalledWith("/dashboard/bots/create");
  });
});
