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
import {
  getHeaderDropdownLinkClass,
  getHeaderDropdownMenuClass,
  getHeaderMenuItemClass,
  headerMenuItemActiveClass,
} from './headerControlStyles';

type NavItem = {
  href: string;
  label: string;
  icon?: IconType;
  activePrefixes?: readonly string[];
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
        <ul className={getHeaderDropdownMenuClass('bottom', 'min-w-64')}>
          {links.map((item, index) => {
            const current = pathname === item.href;
            const ItemIcon = item.icon;
            return (
              <li key={`${label}-${item.href}-${index}`}>
                <Link
                  href={item.href}
                  aria-current={current ? 'page' : undefined}
                  className={getHeaderDropdownLinkClass(current)}
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
    {
      href: dashboardRoutes.exchanges.orders,
      label: t('dashboard.nav.orders'),
      icon: LuShoppingCart,
      activePrefixes: [dashboardRoutes.exchanges.orders],
    },
    {
      href: dashboardRoutes.exchanges.positions,
      label: t('dashboard.nav.positions'),
      icon: LuPackageOpen,
      activePrefixes: [dashboardRoutes.exchanges.positions],
    },
  ];

  const directModuleLinks: NavItem[] = [
    {
      href: dashboardRoutes.markets.list,
      label: t('dashboard.nav.markets'),
      icon: LuChartCandlestick,
      activePrefixes: [dashboardRoutes.markets.root],
    },
    {
      href: dashboardRoutes.strategies.list,
      label: t('dashboard.nav.strategies'),
      icon: LuListChecks,
      activePrefixes: [dashboardRoutes.strategies.root],
    },
    {
      href: dashboardRoutes.backtests.list,
      label: t('dashboard.nav.backtests'),
      icon: LuChartLine,
      activePrefixes: [dashboardRoutes.backtests.root],
    },
    {
      href: dashboardRoutes.bots.list,
      label: t('dashboard.nav.bots'),
      icon: LuBot,
      activePrefixes: [dashboardRoutes.bots.root],
    },
  ];

  const analyticsLinks: NavItem[] = [
    {
      href: dashboardRoutes.analytics.reports,
      label: t('dashboard.nav.reports'),
      icon: LuFileChartColumnIncreasing,
      activePrefixes: [dashboardRoutes.analytics.reports],
    },
    {
      href: dashboardRoutes.analytics.logs,
      label: t('dashboard.nav.logs'),
      icon: LuShieldCheck,
      activePrefixes: [dashboardRoutes.analytics.logs],
    },
  ];

  const exchangeGroup = {
    id: 'exchanges',
    label: t('dashboard.nav.exchanges'),
    icon: LuShoppingCart,
    links: exchangesLinks,
    activePrefixes: [
      dashboardRoutes.exchanges.root,
      dashboardRoutes.exchanges.orders,
      dashboardRoutes.exchanges.positions,
    ],
  } as const;

  const analyticsGroup = {
    id: 'analytics',
    label: t('dashboard.nav.analytics'),
    icon: LuChartBar,
    links: analyticsLinks,
    activePrefixes: [dashboardRoutes.analytics.reports, dashboardRoutes.analytics.logs],
  } as const;

  const allLinks = [homeLink, ...exchangesLinks, ...directModuleLinks, ...analyticsLinks];

  const isActive = (item: NavItem) =>
    item.activePrefixes && item.activePrefixes.length > 0
      ? pathStartsWithAny(pathname, item.activePrefixes)
      : pathname === item.href;
  const isGroupActive = (prefixes: readonly string[]) => pathStartsWithAny(pathname, prefixes);
  const homeLinkClass = getHeaderMenuItemClass(isActive(homeLink));

  const HomeIcon = homeLink.icon;

  return (
    <header className="sticky top-0 z-50 border-b border-base-300/60 bg-base-100/85 backdrop-blur supports-[backdrop-filter]:bg-base-100/80">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="navbar min-h-0 p-0 flex-nowrap justify-between gap-4">
          <div className="flex-none min-w-0 pr-2 xl:pr-4">
            <AppLogoLink
              href="/"
              className="font-normal text-base-content whitespace-nowrap"
              wordmarkClassName="truncate"
            />
          </div>

          <nav aria-label="Dashboard navigation" className="hidden xl:flex flex-1 min-w-0 overflow-visible justify-center">
            <ul className="menu menu-horizontal p-1 gap-1.5 flex-nowrap whitespace-nowrap overflow-visible items-center justify-center">
              <li>
                <Link
                  href={homeLink.href}
                  aria-current={isActive(homeLink) ? 'page' : undefined}
                  className={homeLinkClass}
                >
                  {HomeIcon ? <HomeIcon className='h-4 w-4 opacity-80' aria-hidden /> : null}
                  {homeLink.label}
                </Link>
              </li>
              <NavGroup
                key={exchangeGroup.id}
                active={isGroupActive(exchangeGroup.activePrefixes)}
                label={exchangeGroup.label}
                icon={exchangeGroup.icon}
                links={exchangeGroup.links}
                pathname={pathname}
              />
              {directModuleLinks.map((item) => {
                const ItemIcon = item.icon;
                const itemClass = getHeaderMenuItemClass(isActive(item));
                return (
                  <li key={`direct-${item.href}`}>
                    <Link
                      href={item.href}
                      aria-current={isActive(item) ? 'page' : undefined}
                      className={itemClass}
                    >
                      {ItemIcon ? <ItemIcon className='h-4 w-4 opacity-80' aria-hidden /> : null}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
              <NavGroup
                key={analyticsGroup.id}
                active={isGroupActive(analyticsGroup.activePrefixes)}
                label={analyticsGroup.label}
                icon={analyticsGroup.icon}
                links={analyticsGroup.links}
                pathname={pathname}
              />
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
              className={`btn btn-sm btn-square btn-ghost xl:hidden text-base-content/85 hover:bg-base-200 hover:text-base-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-content/35 transition-colors ${mobileMenuOpen ? headerMenuItemActiveClass : ''}`}
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
              <ul className="menu rounded-box border border-base-300/60 bg-base-200/60 p-2 gap-1 w-full">
                {allLinks.map((item, index) => {
                  const ItemIcon = item.icon;
                  return (
                    <li key={`${item.href}-${index}`}>
                    <Link
                      href={item.href}
                      aria-current={isActive(item) ? 'page' : undefined}
                      className={getHeaderDropdownLinkClass(isActive(item))}
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
