import { describe, expect, it } from "vitest";
import { translations } from "./translations";

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

const readNested = (source: Record<string, unknown>, keyPath: string): unknown =>
  keyPath.split(".").reduce<unknown>((current, key) => {
    if (current == null || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);

describe("translations", () => {
  it("keeps EN, PL and PT translation keys in sync", () => {
    const enKeys = collectKeys(translations.en).sort();
    const plKeys = collectKeys(translations.pl).sort();
    const ptKeys = collectKeys(translations.pt).sort();

    expect(plKeys).toEqual(enKeys);
    expect(ptKeys).toEqual(enKeys);
  });

  it("contains non-empty localized strings for critical nav and runtime keys", () => {
    const criticalKeys = [
      "dashboard.nav.menu",
      "dashboard.nav.botsList",
      "dashboard.nav.createBot",
      "dashboard.home.runtime.runtimeRiskTitle",
      "dashboard.home.runtime.noActiveSessionWarning",
      "dashboard.home.runtime.tradesHistoryTitlePaper",
      "dashboard.bots.monitoring.controlsTitle",
      "dashboard.bots.monitoring.sections.historyTradesTitle",
      "dashboard.bots.assistant.title",
    ];

    for (const key of criticalKeys) {
      const enValue = readNested(translations.en as unknown as Record<string, unknown>, key);
      const plValue = readNested(translations.pl as unknown as Record<string, unknown>, key);
      const ptValue = readNested(translations.pt as unknown as Record<string, unknown>, key);

      expect(enValue, `Missing EN key: ${key}`).toEqual(expect.any(String));
      expect(plValue, `Missing PL key: ${key}`).toEqual(expect.any(String));
      expect(ptValue, `Missing PT key: ${key}`).toEqual(expect.any(String));
      expect(String(enValue).trim().length, `Empty EN translation: ${key}`).toBeGreaterThan(0);
      expect(String(plValue).trim().length, `Empty PL translation: ${key}`).toBeGreaterThan(0);
      expect(String(ptValue).trim().length, `Empty PT translation: ${key}`).toBeGreaterThan(0);
    }
  });

  it("uses pt-PT content for core dashboard shell/home/bots keys", () => {
    const coreKeys = [
      "dashboard.nav.markets",
      "dashboard.common.language",
      "dashboard.logs.title",
      "dashboard.home.controlCenterTitle",
      "dashboard.home.quickActionsStripTitle",
      "dashboard.home.runtime.noActiveBotsTitle",
      "dashboard.home.runtime.onboardingStepWalletTitle",
      "dashboard.home.runtime.onboardingStepMarketsTitle",
      "dashboard.bots.page.title",
      "dashboard.bots.create.description",
      "dashboard.bots.states.emptyTitle",
      "dashboard.bots.monitoring.title",
      "dashboard.bots.monitoring.sections.historyTradesTitle",
    ];

    for (const key of coreKeys) {
      const enValue = readNested(translations.en as unknown as Record<string, unknown>, key);
      const ptValue = readNested(translations.pt as unknown as Record<string, unknown>, key);

      expect(enValue, `Missing EN key: ${key}`).toEqual(expect.any(String));
      expect(ptValue, `Missing PT key: ${key}`).toEqual(expect.any(String));
      expect(String(ptValue).trim().length, `Empty PT translation: ${key}`).toBeGreaterThan(0);
      expect(ptValue, `PT translation should not be EN placeholder for key: ${key}`).not.toEqual(enValue);
    }
  });
});
