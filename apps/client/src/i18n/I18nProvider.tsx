'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, Locale, TranslationKey, translations } from "./translations";

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: TranslationKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "cryptosparrow-locale";

const resolveKey = (obj: unknown, path: TranslationKey): string | undefined => {
  const value = path.split(".").reduce<unknown>((acc, chunk) => {
    if (acc && typeof acc === "object" && chunk in acc) {
      return (acc as Record<string, unknown>)[chunk];
    }
    return undefined;
  }, obj);

  return typeof value === "string" ? value : undefined;
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "en" || raw === "pl") {
      setLocaleState(raw);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
  };

  const t = useCallback((key: TranslationKey) => {
    const localized = resolveKey(translations[locale], key);
    if (localized) return localized;
    const fallback = resolveKey(translations[DEFAULT_LOCALE], key);
    return fallback ?? key;
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return value;
};
