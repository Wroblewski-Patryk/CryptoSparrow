import { describe, expect, it } from "vitest";
import { buildTranslationsForRoute } from "./namespaceRegistry";
import { type Locale, translations } from "./translations";

type RouteSmokeCase = {
  route: string;
  keys: string[];
};

const ROUTE_SMOKE_CASES: RouteSmokeCase[] = [
  {
    route: "/auth/login",
    keys: ["auth.page.login.title", "auth.forms.login.submitIdle"],
  },
  {
    route: "/auth/register",
    keys: ["auth.page.register.title", "auth.forms.register.submitIdle"],
  },
  {
    route: "/dashboard/reports",
    keys: ["dashboard.reports.page.title", "dashboard.reports.states.loadingTitle"],
  },
  {
    route: "/dashboard/markets/create",
    keys: ["dashboard.markets.createLabel", "dashboard.markets.form.sectionTitle"],
  },
  {
    route: "/dashboard/markets/market-1/edit",
    keys: ["dashboard.markets.editLabel", "dashboard.markets.form.sectionTitle"],
  },
  {
    route: "/dashboard/backtests/create",
    keys: ["dashboard.backtests.createLabel", "dashboard.backtests.createForm.title"],
  },
  {
    route: "/dashboard/backtests/list",
    keys: ["dashboard.backtests.listLabel", "dashboard.backtests.listView.loadingTitle"],
  },
  {
    route: "/dashboard/backtests/run-1",
    keys: ["dashboard.backtests.detailsLabel", "dashboard.backtests.runsTable.preview"],
  },
  {
    route: "/dashboard/bots/create",
    keys: ["dashboard.bots.create.title", "dashboard.bots.page.breadcrumbCreate"],
  },
  {
    route: "/dashboard/bots/bot-1/edit",
    keys: ["dashboard.bots.page.breadcrumbUpdate", "dashboard.bots.list.edit"],
  },
  {
    route: "/dashboard/bots/bot-1/assistant",
    keys: ["dashboard.bots.page.breadcrumbAssistant", "dashboard.bots.assistant.title"],
  },
  {
    route: "/dashboard/bots/bot-1/preview",
    keys: ["dashboard.bots.page.breadcrumbPreview", "dashboard.bots.page.title"],
  },
  {
    route: "/offline",
    keys: ["public.offline.title", "public.offline.description"],
  },
  {
    route: "/admin/users",
    keys: ["admin.users.title", "admin.layout.nav.users"],
  },
  {
    route: "/admin/subscriptions",
    keys: ["admin.subscriptions.title", "admin.layout.nav.subscriptions"],
  },
];

const readNested = (source: Record<string, unknown>, keyPath: string): unknown =>
  keyPath.split(".").reduce<unknown>((current, key) => {
    if (current == null || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);

const resolveRouteKey = (locale: Locale, route: string, key: string): string => {
  const localized = readNested(
    buildTranslationsForRoute(locale, route) as unknown as Record<string, unknown>,
    key
  );
  if (typeof localized === "string") return localized;

  const routeFallback = readNested(
    buildTranslationsForRoute("en", route) as unknown as Record<string, unknown>,
    key
  );
  if (typeof routeFallback === "string") return routeFallback;

  const globalFallback = readNested(translations.en as unknown as Record<string, unknown>, key);
  if (typeof globalFallback === "string") return globalFallback;

  return key;
};

describe("route locale smoke", () => {
  it("resolves route-critical keys for en/pl/pt without raw fallback key leakage", () => {
    for (const locale of ["en", "pl", "pt"] as const) {
      for (const testCase of ROUTE_SMOKE_CASES) {
        for (const key of testCase.keys) {
          const resolved = resolveRouteKey(locale, testCase.route, key);

          expect(resolved, `Missing resolved value for ${locale} ${testCase.route} ${key}`).toEqual(
            expect.any(String)
          );
          expect(
            resolved,
            `Raw fallback key leaked for ${locale} ${testCase.route}: ${key}`
          ).not.toEqual(key);
          expect(
            resolved.trim().length,
            `Empty translation for ${locale} ${testCase.route}: ${key}`
          ).toBeGreaterThan(0);
        }
      }
    }
  });
});
