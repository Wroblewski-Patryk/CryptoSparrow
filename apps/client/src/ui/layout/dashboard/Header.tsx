'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';

import ProfileButton from '../../components/ProfileButton';
import ThemeSwitcher from '../../components/ThemeSwitch';
import { useI18n } from '../../../i18n/I18nProvider';
import { useDetailsDropdown } from '../../hooks/useDetailsDropdown';
import LanguageSwitcher from './LanguageSwitcher';
import { dashboardRoutes, pathStartsWithAny } from './dashboardRoutes';
import { getHeaderMenuItemClass } from './headerControlStyles';

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
  const summaryClass = getHeaderMenuItemClass(active);

  return (
    <li>
      <details ref={detailsRef}>
        <summary className={summaryClass}>{label}</summary>
        <ul className="bg-base-100 text-base-content rounded-box min-w-64 p-2 z-[80] shadow-xl border border-base-300/60">
          {links.map((item, index) => {
            const current = pathname === item.href;
            return (
              <li key={`${label}-${item.href}-${index}`}>
                <Link
                  href={item.href}
                  aria-current={current ? 'page' : undefined}
                  className={current ? 'active font-medium' : undefined}
                >
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
          exchangesGroup: 'Gieldy',
          marketsGroup: 'Rynki',
          strategyGroup: 'Strategie',
          backtestGroup: 'Backtest',
          botsGroup: 'Boty',
          analyticsGroup: 'Analityka',
          exchangesConnections: 'Integracje',
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
          exchangesGroup: 'Exchanges',
          marketsGroup: 'Markets',
          strategyGroup: 'Strategies',
          backtestGroup: 'Backtests',
          botsGroup: 'Bots',
          analyticsGroup: 'Analytics',
          exchangesConnections: 'Connections',
          marketList: 'Groups list',
          marketCreate: 'Create group',
          strategyList: 'Strategies list',
          strategyCreate: 'Create strategy',
          backtestList: 'Backtests list',
          backtestCreate: 'Create backtest',
          mobileMenu: 'Menu',
        };

  const homeLink: NavItem = {
    href: dashboardRoutes.home,
    label: labels.home,
  };

  const exchangesLinks: NavItem[] = [
    { href: dashboardRoutes.exchanges.root, label: labels.exchangesConnections },
    { href: dashboardRoutes.exchanges.orders, label: t('dashboard.nav.orders') },
    { href: dashboardRoutes.exchanges.positions, label: t('dashboard.nav.positions') },
  ];

  const marketsLinks: NavItem[] = [
    { href: dashboardRoutes.markets.list, label: labels.marketList },
    { href: dashboardRoutes.markets.create, label: labels.marketCreate },
  ];

  const strategyLinks: NavItem[] = [
    { href: dashboardRoutes.strategies.list, label: labels.strategyList },
    { href: dashboardRoutes.strategies.create, label: labels.strategyCreate },
  ];

  const backtestLinks: NavItem[] = [
    { href: dashboardRoutes.backtests.list, label: labels.backtestList },
    { href: dashboardRoutes.backtests.create, label: labels.backtestCreate },
  ];

  const botsLinks: NavItem[] = [
    { href: dashboardRoutes.bots.root, label: t('dashboard.nav.bots') },
  ];

  const analyticsLinks: NavItem[] = [
    { href: dashboardRoutes.analytics.reports, label: t('dashboard.nav.reports') },
    { href: dashboardRoutes.analytics.logs, label: t('dashboard.nav.logs') },
  ];

  const groups = [
    {
      id: 'exchanges',
      label: labels.exchangesGroup,
      links: exchangesLinks,
      activePrefixes: [
        dashboardRoutes.exchanges.root,
        dashboardRoutes.exchanges.orders,
        dashboardRoutes.exchanges.positions,
      ],
    },
    {
      id: 'markets',
      label: labels.marketsGroup,
      links: marketsLinks,
      activePrefixes: [dashboardRoutes.markets.root],
    },
    {
      id: 'strategies',
      label: labels.strategyGroup,
      links: strategyLinks,
      activePrefixes: [dashboardRoutes.strategies.root],
    },
    {
      id: 'backtests',
      label: labels.backtestGroup,
      links: backtestLinks,
      activePrefixes: [dashboardRoutes.backtests.root],
    },
    {
      id: 'bots',
      label: labels.botsGroup,
      links: botsLinks,
      activePrefixes: [dashboardRoutes.bots.root],
    },
    {
      id: 'analytics',
      label: labels.analyticsGroup,
      links: analyticsLinks,
      activePrefixes: [dashboardRoutes.analytics.reports, dashboardRoutes.analytics.logs],
    },
  ];

  const allLinks = [homeLink, ...exchangesLinks, ...marketsLinks, ...strategyLinks, ...backtestLinks, ...botsLinks, ...analyticsLinks];

  const isActive = (href: string) => pathname === href;
  const isGroupActive = (prefixes: readonly string[]) => pathStartsWithAny(pathname, prefixes);
  const homeLinkClass = getHeaderMenuItemClass(isActive(homeLink.href));

  return (
    <header className="bg-primary sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="navbar min-h-0 px-0 flex-nowrap justify-between gap-4">
          <div className="flex-none min-w-0 pr-2 xl:pr-4">
            <Link href="/dashboard" className="flex items-center gap-2 font-normal text-primary-content whitespace-nowrap">
              <span
                aria-hidden
                className="h-8 w-8 bg-current [mask-image:url('/logo.svg')] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
              />
              <span className="brand-wordmark truncate">CryptoSparrow</span>
            </Link>
          </div>

          <nav aria-label="Dashboard navigation" className="hidden xl:flex flex-1 min-w-0 overflow-visible justify-center">
            <ul className="menu menu-horizontal p-1 gap-1.5 flex-nowrap whitespace-nowrap overflow-visible items-center justify-center">
              <li>
                <Link
                  href={homeLink.href}
                  aria-current={isActive(homeLink.href) ? 'page' : undefined}
                  className={homeLinkClass}
                >
                  {homeLink.label}
                </Link>
              </li>
              {groups.map((group) => (
                <NavGroup
                  key={group.id}
                  active={isGroupActive(group.activePrefixes)}
                  label={group.label}
                  links={group.links}
                  pathname={pathname}
                />
              ))}
            </ul>
          </nav>

          <div className="flex-none flex items-center gap-1 pl-2 xl:pl-4">
            <nav aria-label="Dashboard utility navigation" className="hidden lg:block">
              <ul className="menu menu-horizontal p-0 gap-1 items-center">
                <li><ProfileButton /></li>
                <li><LanguageSwitcher /></li>
                <li><ThemeSwitcher /></li>
              </ul>
            </nav>
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
