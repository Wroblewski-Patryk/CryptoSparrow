'use client';

import LanguageSwitcher from '../layout/dashboard/LanguageSwitcher';
import ThemeSwitcher from './ThemeSwitch';

type FooterPreferencesSwitchersProps = {
  className?: string;
};

export default function FooterPreferencesSwitchers({ className = '' }: FooterPreferencesSwitchersProps) {
  return (
    <nav aria-label="Footer preferences" className={`h-full ${className}`.trim()}>
      <ul className="menu menu-horizontal h-full p-0 gap-1 items-center">
        <li><LanguageSwitcher placement="top" /></li>
        <li><ThemeSwitcher placement="top" /></li>
      </ul>
    </nav>
  );
}
