'use client';

import { useRef } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import { useDetailsDropdown } from '../../hooks/useDetailsDropdown';
import languageOptions from './languageOptions.json';
import { headerMenuItemClass } from './headerControlStyles';

type LocaleCode = 'en' | 'pl';
type LanguageOption = {
  locale: LocaleCode;
  label: string;
  short: string;
  countryCode: string;
  icon: string;
};

type DropdownPlacement = 'top' | 'bottom';
type LanguageSwitcherTone = 'header' | 'footer';

type LanguageSwitcherProps = {
  placement?: DropdownPlacement;
  summaryClassName?: string;
  tone?: LanguageSwitcherTone;
};

const LANGUAGES = languageOptions as LanguageOption[];

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
      {option.icon}
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
  const active = getLanguage(locale as LocaleCode);
  const detailsClass = `dropdown dropdown-end group ${placement === 'top' ? 'dropdown-top' : ''}`;
  const menuClass =
    placement === 'top'
      ? 'menu dropdown-content z-[60] mb-2 w-44 rounded-box bg-base-100 p-2 text-base-content shadow-xl border border-base-300/60'
      : 'menu dropdown-content z-[60] mt-2 w-44 rounded-box bg-base-100 p-2 text-base-content shadow-xl border border-base-300/60';
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
        <span>{active.label}</span>
      </summary>
      <ul className={menuClass}>
        {LANGUAGES.map((option) => (
          <li key={option.locale}>
            <button
              type="button"
              onClick={() => handleSelect(option.locale)}
              className={locale === option.locale ? 'active font-medium' : ''}
            >
              <FlagIcon option={option} />
              {option.label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
