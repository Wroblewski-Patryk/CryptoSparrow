'use client';
import Link from 'next/link';

import ProfileButton from '../../components/ProfileButton';
import ThemeSwitcher from '../../components/ThemeSwitch';
import { useI18n } from '../../../i18n/I18nProvider';
import LanguageSwitcher from './LanguageSwitcher';

export default function Header() {
  const { t } = useI18n();

  return (
    <header className="bg-primary sticky top-0 z-50 shadow-sm">
      <div className="navbar max-w-7xl mx-auto px-4">
        <div className="flex-1">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-base-100">
            <img src="/logo.png" alt="Logotype - CryptoSparrow" className="h-8 w-8 mr-2" />
            CryptoSparrow
          </Link>
        </div>
        <div className="flex-none">
          <ul className="menu menu-horizontal px-1">
            <li><Link href="/dashboard/markets">{t("nav.markets")}</Link></li>
            <li><Link href="/dashboard/builder">{t("nav.builder")}</Link></li>
            <li><Link href="/dashboard/strategies">{t("nav.strategies")}</Link></li>
            <li><Link href="/dashboard/backtest">{t("nav.backtest")}</Link></li>
            <li><Link href="/dashboard/reports">{t("nav.reports")}</Link></li>
            <li><Link href="/dashboard/logs">{t("nav.logs")}</Link></li>
            <li><Link href="/dashboard/exchanges">{t("nav.exchanges")}</Link></li>
            <li><Link href="/dashboard/orders">{t("nav.orders")}</Link></li>
            <li><Link href="/dashboard/positions">{t("nav.positions")}</Link></li>
            <li><Link href="/dashboard/bots">{t("nav.bots")}</Link></li>
          </ul>
          <ul className="menu menu-horizontal px-1">
            <li className="ml-4"><ProfileButton /></li>
          </ul>
          <ul className="menu menu-horizontal px-1">
            <li className="mr-2"><LanguageSwitcher /></li>
            <li><ThemeSwitcher /></li>
          </ul>
        </div>
      </div>
    </header>
  );
}
