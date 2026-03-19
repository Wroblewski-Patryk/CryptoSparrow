'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

import ProfileButton from '../../components/ProfileButton';
import ThemeSwitcher from '../../components/ThemeSwitch';
import { useI18n } from '../../../i18n/I18nProvider';
import LanguageSwitcher from './LanguageSwitcher';
import IsometricModeToggle from './IsometricModeToggle';

export default function Header() {
  const { t } = useI18n();
  const pathname = usePathname();
  const navLinks = [
    { href: "/dashboard/markets", label: t("dashboard.nav.markets") },
    { href: "/dashboard/builder", label: t("dashboard.nav.builder") },
    { href: "/dashboard/strategies", label: t("dashboard.nav.strategies") },
    { href: "/dashboard/backtest", label: t("dashboard.nav.backtest") },
    { href: "/dashboard/reports", label: t("dashboard.nav.reports") },
    { href: "/dashboard/logs", label: t("dashboard.nav.logs") },
    { href: "/dashboard/exchanges", label: t("dashboard.nav.exchanges") },
    { href: "/dashboard/orders", label: t("dashboard.nav.orders") },
    { href: "/dashboard/positions", label: t("dashboard.nav.positions") },
    { href: "/dashboard/bots", label: t("dashboard.nav.bots") },
  ];

  return (
    <header className="bg-primary sticky top-0 z-50 shadow-sm">
      <div className="navbar max-w-7xl mx-auto flex-wrap items-start gap-2 px-4 py-2 xl:flex-nowrap xl:items-center">
        <div className="flex-1 min-w-0">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-base-100">
            <Image src="/logo.png" alt="Logotype - CryptoSparrow" width={32} height={32} className="h-8 w-8 mr-2" />
            <span className="truncate">CryptoSparrow</span>
          </Link>
        </div>
        <div className="flex-none w-full xl:w-auto">
          <nav aria-label="Dashboard navigation">
            <ul className="menu menu-horizontal w-full max-w-full flex-nowrap overflow-x-auto whitespace-nowrap px-1 xl:w-auto xl:overflow-visible">
              {navLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} aria-current={pathname === item.href ? 'page' : undefined}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-2 flex items-center justify-end gap-2 px-1 xl:mt-1">
            <ProfileButton />
            <LanguageSwitcher />
            <IsometricModeToggle />
            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}
