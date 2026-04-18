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

const readSkipLabel = (value: unknown): string | undefined => {
  if (value == null || typeof value !== 'object') return undefined;
  const publicNamespace = value as Record<string, unknown>;
  const a11y = publicNamespace.a11y;
  if (a11y == null || typeof a11y !== 'object') return undefined;
  const label = (a11y as Record<string, unknown>).skipToMainContent;
  return typeof label === 'string' ? label : undefined;
};

const getSkipLabel = (locale: Locale): string => {
  const localized = readSkipLabel(translations[locale].public);
  const fallback = readSkipLabel(translations[DEFAULT_LOCALE].public);
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
