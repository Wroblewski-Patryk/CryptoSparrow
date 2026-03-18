import { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nContext, I18nContextValue } from "./I18nProvider";
import { useLocaleFormatting } from "./useLocaleFormatting";

const createWrapper = (locale: "en" | "pl") => {
  const context: I18nContextValue = {
    locale,
    setLocale: () => undefined,
    t: (key) => key,
  };

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <I18nContext.Provider value={context}>{children}</I18nContext.Provider>
  );
  Wrapper.displayName = `I18nWrapper-${locale}`;
  return Wrapper;
};

describe("useLocaleFormatting", () => {
  it("formats numbers differently for EN and PL locales", () => {
    const en = renderHook(() => useLocaleFormatting(), { wrapper: createWrapper("en") });
    const pl = renderHook(() => useLocaleFormatting(), { wrapper: createWrapper("pl") });

    expect(en.result.current.formatNumber(1234.56)).toBe("1,234.56");
    expect(pl.result.current.formatNumber(1234.56)).toBe("1234,56");
  });

  it("formats currency and percent with locale conventions", () => {
    const en = renderHook(() => useLocaleFormatting(), { wrapper: createWrapper("en") });
    const pl = renderHook(() => useLocaleFormatting(), { wrapper: createWrapper("pl") });

    expect(en.result.current.formatCurrency(1200, "USD")).toContain("$");
    expect(pl.result.current.formatCurrency(1200, "USD")).toContain("USD");
    expect(en.result.current.formatPercent(12.5)).toBe("12.5%");
    expect(pl.result.current.formatPercent(12.5)).toBe("12,5%");
  });

  it("returns safe placeholders for null or invalid date values", () => {
    const { result } = renderHook(() => useLocaleFormatting(), { wrapper: createWrapper("en") });

    expect(result.current.formatDate(null)).toBe("-");
    expect(result.current.formatDate("invalid-date")).toBe("-");
    expect(result.current.formatTime(undefined)).toBe("--:--");
  });
});
