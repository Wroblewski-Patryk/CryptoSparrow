'use client';

import { useMemo } from "react";
import { useContext } from "react";
import { I18nContext } from "./I18nProvider";
import { DEFAULT_LOCALE, Locale } from "./translations";

const localeToIntl: Record<Locale, string> = {
  en: "en-US",
  pl: "pl-PL",
};

const toNumber = (value: number | null | undefined) => (value == null ? null : Number(value));

export function useLocaleFormatting() {
  const i18n = useContext(I18nContext);
  const locale = i18n?.locale ?? DEFAULT_LOCALE;
  const intlLocale = localeToIntl[locale];

  return useMemo(() => {
    const formatDate = (value?: string | null) => {
      if (!value) return "-";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "-";
      return new Intl.DateTimeFormat(intlLocale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);
    };

    const formatDateTime = (value?: string | null) => {
      if (!value) return "-";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "-";
      return new Intl.DateTimeFormat(intlLocale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    };

    const formatTime = (value?: string | null) => {
      if (!value) return "--:--";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "--:--";
      return new Intl.DateTimeFormat(intlLocale, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    };

    const formatNumber = (
      value: number | null | undefined,
      options?: Intl.NumberFormatOptions
    ) => {
      const numeric = toNumber(value);
      if (numeric == null) return "-";
      return new Intl.NumberFormat(intlLocale, options).format(numeric);
    };

    const formatCurrency = (value: number | null | undefined, currency = "USD") => {
      const numeric = toNumber(value);
      if (numeric == null) return "-";
      return new Intl.NumberFormat(intlLocale, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(numeric);
    };

    const formatPercent = (value: number | null | undefined) => {
      const numeric = toNumber(value);
      if (numeric == null) return "-";
      return `${new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2 }).format(numeric)}%`;
    };

    return {
      locale: intlLocale,
      formatDate,
      formatDateTime,
      formatTime,
      formatNumber,
      formatCurrency,
      formatPercent,
    };
  }, [intlLocale]);
}
