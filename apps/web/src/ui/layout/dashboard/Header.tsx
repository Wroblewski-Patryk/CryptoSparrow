'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';
import { type IconType } from 'react-icons';
import {
  LuBot,
  LuChartBar,
  LuChartCandlestick,
  LuFileChartColumnIncreasing,
  LuHouse,
  LuMenu,
  LuChartLine,
  LuListChecks,
  LuPackageOpen,
  LuShieldCheck,
  LuShoppingCart,
  LuX,
} from 'react-icons/lu';

import ProfileButton from '../../components/ProfileButton';
import AppLogoLink from '../../components/AppLogoLink';
import { useI18n } from '../../../i18n/I18nProvider';
import { useDetailsDropdown } from '../../hooks/useDetailsDropdown';
import { dashboardRoutes, pathStartsWithAny } from './dashboardRoutes';
import { getHeaderMenuItemClass, headerMenuItemActiveClass } from './headerControlStyles';

type NavItem = {
  href: string;
  label: string;
  icon?: IconType;
};

type NavGroupProps = {
  active: boolean;
  label: string;
  icon: IconType;
  links: NavItem[];
  pathname: string;
};

function NavGroup({ active, label, icon: Icon, links, pathname }: NavGroupProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useDetailsDropdown(detailsRef);
  const summaryClass = getHeaderMenuItemClass(active);

  return (
    <li>
      <details ref={detailsRef}>
        <summary className={summaryClass}>
          <Icon className='h-4 w-4 opacity-80' aria-hidden />
          {label}
        </summary>
        <ul className="bg-base-100 text-base-content rounded-box min-w-64 p-2 z-[80] shadow-xl border border-base-300/60">
          {links.map((item, index) => {
            const current = pathname === item.href;
            const ItemIcon = item.icon;
            return (
              <li key={`${label}-${item.href}-${index}`}>
                <Link
                  href={item.href}
                  aria-current={current ? 'page' : undefined}
                  className={current ? 'active font-medium' : undefined}
                >
                  {ItemIcon ? <ItemIcon className='h-4 w-4 opacity-75' aria-hidden /> : null}
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
  const { t } = useI18n();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const homeLink: NavItem = {
    href: dashboardRoutes.home,
    label: t('dashboard.nav.home'),
    icon: LuHouse,
  };

  const exchangesLinks: NavItem[] = [
    { href: dashboardRoutes.exchanges.orders, label: t('dashboard.nav.orders'), icon: LuShoppingCart },
    { href: dashboardRoutes.exchanges.positions, label: t('dashboard.nav.positions'), icon: LuPackageOpen },
  ];

  const marketsLinks: NavItem[] = [
    { href: dashboardRoutes.markets.list, label: t('dashboard.nav.marketGroupsList'), icon: LuChartCandlestick },
    { href: dashboardRoutes.markets.create, label: t('dashboard.nav.createMarketGroup'), icon: LuChartCandlestick },
  ];

  const strategyLinks: NavItem[] = [
    { href: dashboardRoutes.strategies.list, label: t('dashboard.nav.strategiesList'), icon: LuListChecks },
    { href: dashboardRoutes.strategies.create, label: t('dashboard.nav.createStrategy'), icon: LuListChecks },
  ];

  const backtestLinks: NavItem[] = [
    { href: dashboardRoutes.backtests.list, label: t('dashboard.nav.backtestsList'), icon: LuChartLine },
    { href: dashboardRoutes.backtests.create, label: t('dashboard.nav.createBacktest'), icon: LuChartLine },
  ];

  const botsLinks: NavItem[] = [
    { href: dashboardRoutes.bots.list, label: t('dashboard.nav.botsList'), icon: LuBot },
    { href: dashboardRoutes.bots.create, label: t('dashboard.nav.createBot'), icon: LuBot },
  ];

  const analyticsLinks: NavItem[] = [
    { href: dashboardRoutes.analytics.reports, label: t('dashboard.nav.reports'), icon: LuFileChartColumnIncreasing },
    { href: dashboardRoutes.analytics.logs, label: t('dashboard.nav.logs'), icon: LuShieldCheck },
  ];

  const groups = [
    {
      id: 'exchanges',
      label: t('dashboard.nav.exchanges'),
      icon: LuShoppingCart,
      links: exchangesLinks,
      activePrefixes: [
        dashboardRoutes.exchanges.root,
        dashboardRoutes.exchanges.orders,
        dashboardRoutes.exchanges.positions,
      ],
    },
    {
      id: 'markets',
      label: t('dashboard.nav.markets'),
      icon: LuChartCandlestick,
      links: marketsLinks,
      activePrefixes: [dashboardRoutes.markets.root],
    },
    {
      id: 'strategies',
      label: t('dashboard.nav.strategies'),
      icon: LuListChecks,
      links: strategyLinks,
      activePrefixes: [dashboardRoutes.strategies.root],
    },
    {
      id: 'backtests',
      label: t('dashboard.nav.backtests'),
      icon: LuChartLine,
      links: backtestLinks,
      activePrefixes: [dashboardRoutes.backtests.root],
    },
    {
      id: 'bots',
      label: t('dashboard.nav.bots'),
      icon: LuBot,
      links: botsLinks,
      activePrefixes: [dashboardRoutes.bots.root],
    },
    {
      id: 'analytics',
      label: t('dashboard.nav.analytics'),
      icon: LuChartBar,
      links: analyticsLinks,
      activePrefixes: [dashboardRoutes.analytics.reports, dashboardRoutes.analytics.logs],
    },
  ];

  const allLinks = [homeLink, ...exchangesLinks, ...marketsLinks, ...strategyLinks, ...backtestLinks, ...botsLinks, ...analyticsLinks];

  const isActive = (href: string) => pathname === href;
  const isGroupActive = (prefixes: readonly string[]) => pathStartsWithAny(pathname, prefixes);
  const homeLinkClass = getHeaderMenuItemClass(isActive(homeLink.href));

  const HomeIcon = homeLink.icon;

  return (
    <header className="bg-primary sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="navbar min-h-0 px-0 flex-nowrap justify-between gap-4">
          <div className="flex-none min-w-0 pr-2 xl:pr-4">
            <AppLogoLink
              href="/"
              className="font-normal text-primary-content whitespace-nowrap"
              wordmarkClassName="truncate"
            />
          </div>

          <nav aria-label="Dashboard navigation" className="hidden xl:flex flex-1 min-w-0 overflow-visible justify-center">
            <ul className="menu menu-horizontal p-1 gap-1.5 flex-nowrap whitespace-nowrap overflow-visible items-center justify-center">
              <li>
                <Link
                  href={homeLink.href}
                  aria-current={isActive(homeLink.href) ? 'page' : undefined}
                  className={homeLinkClass}
                >
                  {HomeIcon ? <HomeIcon className='h-4 w-4 opacity-80' aria-hidden /> : null}
                  {homeLink.label}
                </Link>
              </li>
              {groups.map((group) => (
                <NavGroup
                  key={group.id}
                  active={isGroupActive(group.activePrefixes)}
                  label={group.label}
                  icon={group.icon}
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
              </ul>
            </nav>
            <button
              type="button"
              className={`btn btn-sm btn-square btn-ghost xl:hidden text-primary-content/85 hover:bg-base-100/15 hover:text-primary-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-content/50 transition-colors ${mobileMenuOpen ? headerMenuItemActiveClass : ''}`}
              aria-expanded={mobileMenuOpen}
              aria-controls="dashboard-mobile-nav"
              aria-label={t('dashboard.nav.menu')}
              onClick={() => setMobileMenuOpen((value) => !value)}
            >
              {mobileMenuOpen ? <LuX className='h-5 w-5' aria-hidden /> : <LuMenu className='h-5 w-5' aria-hidden />}
              <span className='sr-only'>{t('dashboard.nav.menu')}</span>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div
            id="dashboard-mobile-nav"
            className="xl:hidden mt-2 w-full max-h-[calc(100vh-5.5rem)] space-y-2 overflow-y-auto overscroll-contain pr-1"
          >
            <nav aria-label="Dashboard navigation" className="w-full">
              <ul className="menu rounded-box bg-base-100/10 p-2 gap-1 w-full">
                {allLinks.map((item, index) => {
                  const ItemIcon = item.icon;
                  return (
                    <li key={`${item.href}-${index}`}>
                    <Link
                      href={item.href}
                      aria-current={isActive(item.href) ? 'page' : undefined}
                      className={isActive(item.href) ? 'active font-medium' : undefined}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {ItemIcon ? <ItemIcon className='h-4 w-4 opacity-75' aria-hidden /> : null}
                      {item.label}
                    </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="w-full">
              <ProfileButton mobile onNavigate={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
