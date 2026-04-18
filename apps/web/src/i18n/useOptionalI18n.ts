'use client';

import { useContext } from 'react';
import { I18nContext } from './I18nProvider';
import { DEFAULT_LOCALE, translations, type TranslationKey } from './translations';

const resolveKey = (obj: unknown, path: string): string | undefined => {
  const value = path.split('.').reduce<unknown>((acc, chunk) => {
    if (acc && typeof acc === 'object' && chunk in acc) {
      return (acc as Record<string, unknown>)[chunk];
    }
    return undefined;
  }, obj);

  return typeof value === 'string' ? value : undefined;
};

export const useOptionalI18n = () => {
  const context = useContext(I18nContext);

  const t = (key: TranslationKey, fallback?: string) => {
    if (context) return context.t(key);
    const defaultValue = resolveKey(translations[DEFAULT_LOCALE], key);
    return defaultValue ?? fallback ?? String(key);
  };

  return {
    t,
    hasProvider: Boolean(context),
  };
};
