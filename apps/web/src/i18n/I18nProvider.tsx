'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, Locale, TranslationKey, translations } from "./translations";
import { getLocalStorageItem, setLocalStorageItem } from "@/lib/storage";
import { resolveNamespacesForRoute } from "./namespaceRegistry";

export type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  timeZone: string;
  timeZonePreference: string;
  setTimeZonePreference: (next: string) => void;
  t: (key: TranslationKey) => string;
};

export const I18nContext = createContext<I18nContextValue | null>(null);

const LOCALE_STORAGE_KEY = "cryptosparrow-locale";
const TIMEZONE_STORAGE_KEY = "cryptosparrow-timezone";
const AUTO_TIMEZONE = "auto";
const missingTranslationWarnings = new Set<string>();

const detectSystemTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const isValidTimeZone = (value: string) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

const normalizeTimeZonePreference = (value: string | null | undefined) => {
  const normalized = value?.trim();
  if (!normalized || normalized === AUTO_TIMEZONE) return AUTO_TIMEZONE;
  return isValidTimeZone(normalized) ? normalized : AUTO_TIMEZONE;
};

const resolveKey = (obj: unknown, path: TranslationKey): string | undefined => {
  const value = path.split(".").reduce<unknown>((acc, chunk) => {
    if (acc && typeof acc === "object" && chunk in acc) {
      return (acc as Record<string, unknown>)[chunk];
    }
    return undefined;
  }, obj);

  return typeof value === "string" ? value : undefined;
};

const reportMissingTranslation = (locale: Locale, key: TranslationKey, hasFallback: boolean) => {
  if (process.env.NODE_ENV === "production") return;

  const path = typeof window === "undefined" ? "ssr" : window.location.pathname || "/";
  const namespaces = resolveNamespacesForRoute(path);
  const cacheKey = `${locale}|${path}|${String(key)}`;
  if (missingTranslationWarnings.has(cacheKey)) return;

  missingTranslationWarnings.add(cacheKey);
  const fallbackState = hasFallback ? "using EN fallback" : "missing EN fallback";
  console.warn(
    `[i18n] Missing key "${key}" for locale "${locale}" at route "${path}" (${fallbackState}); expected namespaces: ${namespaces.join(", ")}`
  );
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [timeZonePreference, setTimeZonePreferenceState] = useState<string>(AUTO_TIMEZONE);
  const [timeZone, setTimeZoneState] = useState<string>(detectSystemTimeZone());

  useEffect(() => {
    const raw = getLocalStorageItem(LOCALE_STORAGE_KEY);
    if (raw === "en" || raw === "pl" || raw === "pt") {
      setLocaleState(raw);
    }

    const storedTimeZone = normalizeTimeZonePreference(getLocalStorageItem(TIMEZONE_STORAGE_KEY));
    setTimeZonePreferenceState(storedTimeZone);
    setTimeZoneState(storedTimeZone === AUTO_TIMEZONE ? detectSystemTimeZone() : storedTimeZone);
  }, []);

  useEffect(() => {
    setLocalStorageItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    setLocalStorageItem(TIMEZONE_STORAGE_KEY, timeZonePreference);
    setTimeZoneState(
      timeZonePreference === AUTO_TIMEZONE ? detectSystemTimeZone() : timeZonePreference
    );
  }, [timeZonePreference]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const setTimeZonePreference = useCallback((next: string) => {
    setTimeZonePreferenceState(normalizeTimeZonePreference(next));
  }, []);

  const t = useCallback((key: TranslationKey) => {
    const localized = resolveKey(translations[locale], key);
    if (localized) return localized;
    const fallback = resolveKey(translations[DEFAULT_LOCALE], key);
    reportMissingTranslation(locale, key, Boolean(fallback));
    return fallback ?? key;
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      timeZone,
      timeZonePreference,
      setTimeZonePreference,
      t,
    }),
    [locale, setLocale, setTimeZonePreference, t, timeZone, timeZonePreference]
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
