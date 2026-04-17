'use client';

import { useRef } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import type { Locale } from '../../../i18n/translations';
import { useDetailsDropdown } from '../../hooks/useDetailsDropdown';
import { getHeaderDropdownLinkClass, getHeaderDropdownMenuClass, headerMenuItemClass } from './headerControlStyles';

type LocaleCode = Locale;
type LanguageOption = {
  locale: LocaleCode;
  labelKey: string;
  shortLabel: string;
  countryCode: string;
  flag: string;
};

type DropdownPlacement = 'top' | 'bottom';
type LanguageSwitcherTone = 'header' | 'footer';

type LanguageSwitcherProps = {
  placement?: DropdownPlacement;
  summaryClassName?: string;
  tone?: LanguageSwitcherTone;
};

const LANGUAGES: LanguageOption[] = [
  {
    locale: 'en',
    labelKey: 'public.localeNames.en',
    shortLabel: 'EN',
    countryCode: 'gb',
    flag: '🇬🇧',
  },
  {
    locale: 'pl',
    labelKey: 'public.localeNames.pl',
    shortLabel: 'PL',
    countryCode: 'pl',
    flag: '🇵🇱',
  },
  {
    locale: 'pt',
    labelKey: 'public.localeNames.pt',
    shortLabel: 'PT',
    countryCode: 'pt',
    flag: '🇵🇹',
  },
];

const getLanguage = (locale: LocaleCode) =>
  LANGUAGES.find((item) => item.locale === locale) ?? LANGUAGES[0];

function FlagIcon({ option }: { option: LanguageOption }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-4 w-6 items-center justify-center text-sm leading-none"
      data-testid={`flag-${option.locale}`}
      title={option.countryCode.toUpperCase()}
    >
      {option.flag}
    </span>
  );
}

export default function LanguageSwitcher({
  placement = 'bottom',
  summaryClassName = '',
  tone = 'header',
}: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useDetailsDropdown(detailsRef);
  const active = getLanguage(locale);
  const activeLabel = t(active.labelKey);
  const detailsClass = `dropdown dropdown-end group ${placement === 'top' ? 'dropdown-top' : ''}`;
  const menuClass = getHeaderDropdownMenuClass(placement, 'w-44');
  const summaryToneClass =
    tone === 'footer'
      ? 'inline-flex min-h-9 items-center gap-2 rounded-md px-3 py-2 text-base-content/80 hover:bg-base-content/10 hover:text-base-content/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-content/35 transition-colors group-open:bg-base-content/10 group-open:text-base-content/80 list-none cursor-pointer [&::-webkit-details-marker]:hidden'
      : `${headerMenuItemClass} font-normal`;

  const handleSelect = (next: LocaleCode) => {
    setLocale(next);
    if (detailsRef.current) detailsRef.current.open = false;
  };

  return (
    <details ref={detailsRef} className={detailsClass}>
      <summary className={`${summaryToneClass} ${summaryClassName}`.trim()} aria-label={t('dashboard.common.language')}>
        <FlagIcon option={active} />
        <span>{activeLabel || active.shortLabel}</span>
      </summary>
      <ul className={menuClass}>
        {LANGUAGES.map((option) => (
          <li key={option.locale}>
            <button
              type="button"
              onClick={() => handleSelect(option.locale)}
              className={getHeaderDropdownLinkClass(locale === option.locale)}
            >
              <FlagIcon option={option} />
              {t(option.labelKey)}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
