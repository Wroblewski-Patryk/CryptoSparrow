'use client';

import ThemeSwitcher from "../../components/ThemeSwitch";
import { useI18n } from "../../../i18n/I18nProvider";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="bg-primary py-4 text-primary-content">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4">
        <p className="text-sm opacity-90">
          &copy; {new Date().getFullYear()} CryptoSparrow. {t("dashboard.footer.rights")}
        </p>
        <nav aria-label="Footer preferences">
          <ul className="menu menu-horizontal p-0 gap-1 items-center">
            <li><LanguageSwitcher placement="top" /></li>
            <li><ThemeSwitcher placement="top" /></li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
