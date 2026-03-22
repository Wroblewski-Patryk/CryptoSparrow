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

describe("translations", () => {
  it("keeps EN and PL translation keys in sync", () => {
    const enKeys = collectKeys(translations.en).sort();
    const plKeys = collectKeys(translations.pl).sort();

    expect(plKeys).toEqual(enKeys);
  });
});
