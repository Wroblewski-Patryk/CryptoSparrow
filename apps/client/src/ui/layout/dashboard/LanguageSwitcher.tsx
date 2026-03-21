'use client';

import { useRef } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import { useDetailsDropdown } from '../../hooks/useDetailsDropdown';

const LANGUAGES = {
  en: { label: 'English', short: 'EN', flagClass: 'bg-[linear-gradient(90deg,#1d4ed8_0_33%,#ffffff_33%_66%,#dc2626_66%)]' },
  pl: { label: 'Polski', short: 'PL', flagClass: 'bg-[linear-gradient(180deg,#ffffff_0_50%,#dc2626_50%_100%)]' },
} as const;

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
        <span aria-hidden className={`inline-block h-3 w-5 rounded-sm border border-base-300 ${active.flagClass}`} />
        <span>{active.short}</span>
      </summary>
      <ul className="menu dropdown-content z-[60] mt-2 w-44 rounded-box bg-base-100 p-2 text-base-content shadow">
        <li>
          <button type="button" onClick={() => handleSelect('en')} className={locale === 'en' ? 'active' : ''}>
            <span aria-hidden className={`inline-block h-3 w-5 rounded-sm border border-base-300 ${LANGUAGES.en.flagClass}`} />
            {LANGUAGES.en.label}
          </button>
        </li>
        <li>
          <button type="button" onClick={() => handleSelect('pl')} className={locale === 'pl' ? 'active' : ''}>
            <span aria-hidden className={`inline-block h-3 w-5 rounded-sm border border-base-300 ${LANGUAGES.pl.flagClass}`} />
            {LANGUAGES.pl.label}
          </button>
        </li>
      </ul>
    </details>
  );
}
