import { describe, expect, it } from "vitest";
import {
  probeBinanceApiKeyPermissions,
  BinanceClientLike,
} from "./binanceApiKeyProbe.service";

type ClientFactory = (
  marketType: "spot" | "future"
) => Promise<BinanceClientLike>;

const withFactory = (factory: ClientFactory) => {
  return probeBinanceApiKeyPermissions(
    {
      apiKey: "test-key",
      apiSecret: "test-secret",
    },
    (marketType) => factory(marketType)
  );
};

describe("probeBinanceApiKeyPermissions", () => {
  it("returns OK when spot and futures probes pass", async () => {
    const result = await withFactory(async () => ({
      fetchBalance: async () => undefined,
    }));

    expect(result).toEqual({
      ok: true,
      code: "OK",
      message: "Binance API key permissions validated.",
      permissions: {
        spot: true,
        futures: true,
      },
    });
  });

  it("maps invalid key error", async () => {
    const result = await withFactory(async () => ({
      fetchBalance: async () => {
        throw new Error("Invalid API-key, IP, or permissions for action.");
      },
    }));

    expect(result.ok).toBe(false);
    expect(result.code).toBe("INVALID_KEY");
    expect(result.permissions).toEqual({ spot: false, futures: false });
  });

  it("maps futures permission mismatch after successful spot probe", async () => {
    const result = await withFactory(async (marketType) => ({
      fetchBalance: async () => {
        if (marketType === "future") {
          throw new Error("Permission denied");
        }
      },
    }));

    expect(result.ok).toBe(false);
    expect(result.code).toBe("MISSING_FUTURES_SCOPE");
    expect(result.permissions).toEqual({ spot: true, futures: false });
  });

  it("maps network timeout error", async () => {
    const result = await withFactory(async () => ({
      fetchBalance: async () => {
        throw new Error("Network timeout on request");
      },
    }));

    expect(result.ok).toBe(false);
    expect(result.code).toBe("NETWORK_TIMEOUT");
    expect(result.permissions).toEqual({ spot: false, futures: false });
  });
});
