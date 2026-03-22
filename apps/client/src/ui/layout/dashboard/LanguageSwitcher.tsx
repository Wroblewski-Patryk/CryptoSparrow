'use client';

import { useRef } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import { useDetailsDropdown } from '../../hooks/useDetailsDropdown';

const LANGUAGES = {
  en: { label: 'English', short: 'EN' },
  pl: { label: 'Polski', short: 'PL' },
} as const;

function FlagIcon({ locale }: { locale: 'en' | 'pl' }) {
  if (locale === 'pl') {
    return (
      <svg
        aria-hidden
        viewBox="0 0 20 14"
        className="inline-block h-3 w-5 rounded-sm border border-base-300"
        data-testid="flag-pl"
      >
        <rect x="0" y="0" width="20" height="7" fill="#ffffff" />
        <rect x="0" y="7" width="20" height="7" fill="#dc2626" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden
      viewBox="0 0 20 14"
      className="inline-block h-3 w-5 rounded-sm border border-base-300"
      data-testid="flag-en"
    >
      <rect x="0" y="0" width="20" height="14" fill="#1d4ed8" />
      <line x1="0" y1="0" x2="20" y2="14" stroke="#ffffff" strokeWidth="4" />
      <line x1="20" y1="0" x2="0" y2="14" stroke="#ffffff" strokeWidth="4" />
      <line x1="0" y1="0" x2="20" y2="14" stroke="#dc2626" strokeWidth="2" />
      <line x1="20" y1="0" x2="0" y2="14" stroke="#dc2626" strokeWidth="2" />
      <rect x="8" y="0" width="4" height="14" fill="#ffffff" />
      <rect x="0" y="5" width="20" height="4" fill="#ffffff" />
      <rect x="8.8" y="0" width="2.4" height="14" fill="#dc2626" />
      <rect x="0" y="5.8" width="20" height="2.4" fill="#dc2626" />
    </svg>
  );
}

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useDetailsDropdown(detailsRef);
  const active = LANGUAGES[locale];

  const handleSelect = (next: 'en' | 'pl') => {
    setLocale(next);
    if (detailsRef.current) detailsRef.current.open = false;
  };

  return (
    <details ref={detailsRef} className="dropdown dropdown-end">
      <summary className="btn btn-sm btn-ghost text-primary-content" aria-label={t('dashboard.common.language')}>
        <FlagIcon locale={locale} />
        <span>{active.short}</span>
      </summary>
      <ul className="menu dropdown-content z-[60] mt-2 w-44 rounded-box bg-base-100 p-2 text-base-content shadow">
        <li>
          <button type="button" onClick={() => handleSelect('en')} className={locale === 'en' ? 'active' : ''}>
            <FlagIcon locale="en" />
            {LANGUAGES.en.label}
          </button>
        </li>
        <li>
          <button type="button" onClick={() => handleSelect('pl')} className={locale === 'pl' ? 'active' : ''}>
            <FlagIcon locale="pl" />
            {LANGUAGES.pl.label}
          </button>
        </li>
      </ul>
    </details>
  );
}
