'use client';

import { useOptionalI18n } from '@/i18n/useOptionalI18n';
import LanguageSwitcher from '../layout/dashboard/LanguageSwitcher';
import ThemeSwitcher from './ThemeSwitch';

type FooterPreferencesSwitchersProps = {
  className?: string;
  summaryClassName?: string;
  tone?: 'header' | 'footer';
};

export default function FooterPreferencesSwitchers({
  className = '',
  summaryClassName = '',
  tone = 'header',
}: FooterPreferencesSwitchersProps) {
  const { t } = useOptionalI18n();

  return (
    <nav aria-label={t('public.a11y.footerPreferences')} className={`h-full ${className}`.trim()}>
      <ul className="menu menu-horizontal h-full p-0 gap-1 items-center">
        <li><LanguageSwitcher placement="top" summaryClassName={summaryClassName} tone={tone} /></li>
        <li><ThemeSwitcher placement="top" summaryClassName={summaryClassName} tone={tone} /></li>
      </ul>
    </nav>
  );
}
