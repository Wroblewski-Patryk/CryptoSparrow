'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, Locale, TranslationKey, translations } from "./translations";
import { getLocalStorageItem, setLocalStorageItem } from "@/lib/storage";
import { buildTranslationsForRoute, resolveNamespacesForRoute } from "./namespaceRegistry";

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
const ROUTE_CHANGE_EVENT = "cryptosparrow:i18n-route-change";

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

const detectRoutePath = () => {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
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

const reportMissingTranslation = (
  locale: Locale,
  key: TranslationKey,
  hasFallback: boolean,
  routePath: string
) => {
  if (process.env.NODE_ENV === "production") return;

  const namespaces = resolveNamespacesForRoute(routePath);
  const cacheKey = `${locale}|${routePath}|${String(key)}`;
  if (missingTranslationWarnings.has(cacheKey)) return;

  missingTranslationWarnings.add(cacheKey);
  const fallbackState = hasFallback ? "using EN fallback" : "missing EN fallback";
  console.warn(
    `[i18n] Missing key "${key}" for locale "${locale}" at route "${routePath}" (${fallbackState}); expected namespaces: ${namespaces.join(", ")}`
  );
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [timeZonePreference, setTimeZonePreferenceState] = useState<string>(AUTO_TIMEZONE);
  const [timeZone, setTimeZoneState] = useState<string>(detectSystemTimeZone());
  const [routePath, setRoutePath] = useState<string>(detectRoutePath);

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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncRoutePath = () => {
      setRoutePath(detectRoutePath());
    };

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = ((...args: Parameters<History["pushState"]>) => {
      originalPushState(...args);
      window.dispatchEvent(new Event(ROUTE_CHANGE_EVENT));
    }) as History["pushState"];

    window.history.replaceState = ((...args: Parameters<History["replaceState"]>) => {
      originalReplaceState(...args);
      window.dispatchEvent(new Event(ROUTE_CHANGE_EVENT));
    }) as History["replaceState"];

    window.addEventListener("popstate", syncRoutePath);
    window.addEventListener(ROUTE_CHANGE_EVENT, syncRoutePath);
    syncRoutePath();

    return () => {
      window.history.pushState = originalPushState as History["pushState"];
      window.history.replaceState = originalReplaceState as History["replaceState"];
      window.removeEventListener("popstate", syncRoutePath);
      window.removeEventListener(ROUTE_CHANGE_EVENT, syncRoutePath);
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const setTimeZonePreference = useCallback((next: string) => {
    setTimeZonePreferenceState(normalizeTimeZonePreference(next));
  }, []);

  const routeTranslations = useMemo(
    () => buildTranslationsForRoute(locale, routePath),
    [locale, routePath]
  );
  const routeFallbackTranslations = useMemo(
    () => buildTranslationsForRoute(DEFAULT_LOCALE, routePath),
    [routePath]
  );

  const t = useCallback((key: TranslationKey) => {
    const localized = resolveKey(routeTranslations, key);
    if (localized) return localized;
    const routeFallback = resolveKey(routeFallbackTranslations, key);
    if (routeFallback) {
      reportMissingTranslation(locale, key, true, routePath);
      return routeFallback;
    }

    const globalFallback = resolveKey(translations[DEFAULT_LOCALE], key);
    reportMissingTranslation(locale, key, Boolean(globalFallback), routePath);
    return globalFallback ?? key;
  }, [locale, routeFallbackTranslations, routePath, routeTranslations]);

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
