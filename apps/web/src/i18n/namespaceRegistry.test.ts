import { describe, expect, it } from "vitest";
import {
  ALL_I18N_NAMESPACES,
  buildTranslationsForRoute,
  clearRouteTranslationCache,
  I18N_NAMESPACE_REGISTRY,
  resolveNamespacesForRoute,
} from "./namespaceRegistry";

const collectKeys = (value: unknown, prefix = ""): string[] => {
  if (value == null || typeof value !== "object") {
    return [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    if (nested != null && typeof nested === "object") {
      return collectKeys(nested, next);
    }
    return [next];
  });
};

describe("namespaceRegistry", () => {
  it("builds route-scoped dictionaries with deterministic namespace ownership", () => {
    clearRouteTranslationCache();
    const backtestsRoute = buildTranslationsForRoute("en", "/dashboard/backtests/list") as Record<
      string,
      unknown
    >;
    const marketsRoute = buildTranslationsForRoute("en", "/dashboard/markets/list") as Record<
      string,
      unknown
    >;

    const read = (source: Record<string, unknown>, path: string): unknown =>
      path.split(".").reduce<unknown>((current, key) => {
        if (current == null || typeof current !== "object") return undefined;
        return (current as Record<string, unknown>)[key];
      }, source);

    expect(read(backtestsRoute, "dashboard.backtests.createLabel")).toBe("Create");
    expect(read(backtestsRoute, "dashboard.markets.title")).toBeUndefined();
    expect(read(marketsRoute, "dashboard.markets.title")).toBe("Markets");
    expect(read(marketsRoute, "dashboard.backtests.createLabel")).toBeUndefined();
  });

  it("keeps en/pl/pt key parity for every namespace with explicit missing-key report", () => {
    const report: string[] = [];

    for (const namespace of ALL_I18N_NAMESPACES) {
      const enKeys = collectKeys(I18N_NAMESPACE_REGISTRY[namespace].en).sort();
      const plKeys = new Set(collectKeys(I18N_NAMESPACE_REGISTRY[namespace].pl));
      const ptKeys = new Set(collectKeys(I18N_NAMESPACE_REGISTRY[namespace].pt));

      const missingInPl = enKeys.filter((key) => !plKeys.has(key));
      const missingInPt = enKeys.filter((key) => !ptKeys.has(key));

      if (missingInPl.length > 0) {
        report.push(`[${namespace}] missing in pl: ${missingInPl.join(", ")}`);
      }
      if (missingInPt.length > 0) {
        report.push(`[${namespace}] missing in pt: ${missingInPt.join(", ")}`);
      }
    }

    expect(report, report.join("\n")).toEqual([]);
  });

  it("maps route domains to deterministic namespace sets", () => {
    expect(resolveNamespacesForRoute("/")).toEqual(["public", "dashboardShell"]);
    expect(resolveNamespacesForRoute("/auth/login")).toEqual(["public", "dashboardShell", "auth"]);
    expect(resolveNamespacesForRoute("/dashboard/backtests/create")).toEqual([
      "public",
      "dashboardShell",
      "dashboardBacktests",
    ]);
    expect(resolveNamespacesForRoute("/dashboard/bots")).toEqual([
      "public",
      "dashboardShell",
      "dashboardBots",
    ]);
  });
});
