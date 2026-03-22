'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';

import ProfileButton from '../../components/ProfileButton';
import ThemeSwitcher from '../../components/ThemeSwitch';
import { useI18n } from '../../../i18n/I18nProvider';
import { useDetailsDropdown } from '../../hooks/useDetailsDropdown';
import LanguageSwitcher from './LanguageSwitcher';

type NavItem = {
  href: string;
  label: string;
};

type NavGroupProps = {
  active: boolean;
  label: string;
  links: NavItem[];
  pathname: string;
};

function NavGroup({ active, label, links, pathname }: NavGroupProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useDetailsDropdown(detailsRef);

  return (
    <li>
      <details ref={detailsRef}>
        <summary className={active ? 'active font-medium' : undefined}>{label}</summary>
        <ul className="bg-base-100 text-base-content rounded-box min-w-64 p-2 z-[80]">
          {links.map((item, index) => {
            const current = pathname === item.href;
            return (
              <li key={`${label}-${item.href}-${index}`}>
                <Link href={item.href} aria-current={current ? 'page' : undefined} className={current ? 'active font-medium' : undefined}>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </details>
    </li>
  );
}

export default function Header() {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const labels =
    locale === 'pl'
      ? {
          home: 'Pulpit',
          marketsGroup: 'Rynki',
          strategyGroup: 'Strategie',
          backtestGroup: 'Backtest',
          executionGroup: 'Wykonanie',
          analyticsGroup: 'Analityka',
          marketList: 'Lista grup',
          marketCreate: 'Dodaj grupe',
          strategyList: 'Lista strategii',
          strategyCreate: 'Dodaj strategie',
          backtestList: 'Lista backtestow',
          backtestCreate: 'Nowy backtest',
          mobileMenu: 'Menu',
        }
      : {
          home: 'Dashboard',
          marketsGroup: 'Markets',
          strategyGroup: 'Strategies',
          backtestGroup: 'Backtests',
          executionGroup: 'Execution',
          analyticsGroup: 'Analytics',
          marketList: 'Groups list',
          marketCreate: 'Create group',
          strategyList: 'Strategies list',
          strategyCreate: 'Create strategy',
          backtestList: 'Backtests list',
          backtestCreate: 'Create backtest',
          mobileMenu: 'Menu',
        };

  const homeLink: NavItem = {
    href: '/dashboard',
    label: labels.home,
  };

  const marketsLinks: NavItem[] = [
    { href: '/dashboard/markets/list', label: labels.marketList },
    { href: '/dashboard/markets/create', label: labels.marketCreate },
  ];

  const strategyLinks: NavItem[] = [
    { href: '/dashboard/strategies/list', label: labels.strategyList },
    { href: '/dashboard/strategies/create', label: labels.strategyCreate },
  ];

  const backtestLinks: NavItem[] = [
    { href: '/dashboard/backtests/list', label: labels.backtestList },
    { href: '/dashboard/backtests/create', label: labels.backtestCreate },
  ];

  const executionLinks: NavItem[] = [
    { href: '/dashboard/bots', label: t('dashboard.nav.bots') },
    { href: '/dashboard/orders', label: t('dashboard.nav.orders') },
    { href: '/dashboard/positions', label: t('dashboard.nav.positions') },
  ];

  const analyticsLinks: NavItem[] = [
    { href: '/dashboard/reports', label: t('dashboard.nav.reports') },
    { href: '/dashboard/logs', label: t('dashboard.nav.logs') },
  ];

  const groups = [
    { id: 'markets', label: labels.marketsGroup, links: marketsLinks },
    { id: 'strategies', label: labels.strategyGroup, links: strategyLinks },
    { id: 'backtests', label: labels.backtestGroup, links: backtestLinks },
    { id: 'execution', label: labels.executionGroup, links: executionLinks },
    { id: 'analytics', label: labels.analyticsGroup, links: analyticsLinks },
  ];

  const allLinks = [homeLink, ...marketsLinks, ...strategyLinks, ...backtestLinks, ...executionLinks, ...analyticsLinks];

  const isActive = (href: string) => pathname === href;
  const isGroupActive = (links: NavItem[]) => links.some((item) => isActive(item.href));

  return (
    <header className="bg-primary sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="navbar min-h-0 px-0 flex-nowrap justify-between gap-4">
          <div className="flex-none min-w-0 pr-2 xl:pr-4">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-primary-content whitespace-nowrap">
              <span
                aria-hidden
                className="h-8 w-8 bg-current [mask-image:url('/logo.svg')] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
              />
              <span className="truncate tracking-wide">CryptoSparrow</span>
            </Link>
          </div>

          <nav aria-label="Dashboard navigation" className="hidden xl:block flex-1 min-w-0 px-2 xl:px-4 overflow-visible">
            <ul className="menu menu-horizontal rounded-box bg-base-100/10 p-1 gap-1 flex-nowrap whitespace-nowrap overflow-visible">
              <li>
                <Link
                  href={homeLink.href}
                  aria-current={isActive(homeLink.href) ? 'page' : undefined}
                  className={isActive(homeLink.href) ? 'active font-medium' : undefined}
                >
                  {homeLink.label}
                </Link>
              </li>
              {groups.map((group) => (
                <NavGroup
                  key={group.id}
                  active={isGroupActive(group.links)}
                  label={group.label}
                  links={group.links}
                  pathname={pathname}
                />
              ))}
            </ul>
          </nav>

          <div className="flex-none flex items-center gap-1 pl-2 xl:pl-4">
            <div className="hidden lg:flex items-center gap-1">
              <ProfileButton />
              <LanguageSwitcher />
              <ThemeSwitcher />
            </div>
            <button
              type="button"
              className="btn btn-sm btn-ghost text-base-100 xl:hidden"
              aria-expanded={mobileMenuOpen}
              aria-controls="dashboard-mobile-nav"
              onClick={() => setMobileMenuOpen((value) => !value)}
            >
              {labels.mobileMenu}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div id="dashboard-mobile-nav" className="xl:hidden mt-2 space-y-2">
            <nav aria-label="Dashboard navigation">
              <ul className="menu rounded-box bg-base-100/10 p-2 gap-1">
                {allLinks.map((item, index) => (
                  <li key={`${item.href}-${index}`}>
                    <Link
                      href={item.href}
                      aria-current={isActive(item.href) ? 'page' : undefined}
                      className={isActive(item.href) ? 'active font-medium' : undefined}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="flex items-center gap-2">
              <ProfileButton />
              <LanguageSwitcher />
              <ThemeSwitcher />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
