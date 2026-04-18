'use client';

import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale, translations } from '@/i18n/translations';
import { getLocalStorageItem } from '@/lib/storage';

const resolveLocale = (raw: string | null): Locale => {
  if (raw && (SUPPORTED_LOCALES as readonly string[]).includes(raw)) {
    return raw as Locale;
  }
  return DEFAULT_LOCALE;
};

const getSkipLabel = (locale: Locale): string => {
  const localized = (translations[locale].public as any)?.a11y?.skipToMainContent as
    | string
    | undefined;
  const fallback = (translations[DEFAULT_LOCALE].public as any)?.a11y?.skipToMainContent as
    | string
    | undefined;
  return localized ?? fallback ?? 'Skip to main content';
};

export default function SkipToContentLink() {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    setLocale(resolveLocale(getLocalStorageItem('cryptosparrow-locale')));
  }, []);

  const label = useMemo(() => getSkipLabel(locale), [locale]);

  return (
    <a href="#main-content" className="skip-link">
      {label}
    </a>
  );
}
