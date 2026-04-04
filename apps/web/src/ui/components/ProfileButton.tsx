'use client';

import Link from 'next/link';
import type { MouseEvent } from 'react';
import { useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LuKey, LuLogOut, LuSettings, LuSubscript, LuUser } from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nProvider';
import { useDetailsDropdown } from '../hooks/useDetailsDropdown';
import {
  getHeaderDropdownLinkClass,
  getHeaderDropdownMenuClass,
  headerMenuItemClass,
} from '../layout/dashboard/headerControlStyles';

type ProfileButtonProps = {
  mobile?: boolean;
  onNavigate?: () => void;
};

export default function ProfileButton({ mobile = false, onNavigate }: ProfileButtonProps) {
  const { locale } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const { loading, logout, user } = useAuth();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useDetailsDropdown(detailsRef);
  const copy = locale === 'pl'
    ? {
        myAccount: 'Moje konto',
        basic: 'Dane podstawowe',
        subscription: 'Subskrypcja',
        security: 'Bezpieczenstwo',
        api: 'Integracje i API keys',
        logout: 'Wyloguj',
        openMenu: 'Otworz menu konta',
      }
    : {
        myAccount: 'My account',
        basic: 'Basic profile',
        subscription: 'Subscription',
        security: 'Security',
        api: 'Integrations and API keys',
        logout: 'Sign out',
        openMenu: 'Open account menu',
      };

  const handleProfileSectionNavigation = (
    section: 'basic' | 'api' | 'subscription' | 'security',
    event?: MouseEvent<HTMLElement>
  ) => {
    onNavigate?.();
    if (detailsRef.current) detailsRef.current.open = false;

    const hasModifier =
      Boolean(event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0));
    if (hasModifier) return;

    const target = `/dashboard/profile#${section}`;
    if (pathname === '/dashboard/profile' && typeof window !== 'undefined') {
      event?.preventDefault();
      const nextHash = `#${section}`;
      if (window.location.hash !== nextHash) {
        window.location.hash = section;
      }
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      return;
    }

    if (event) {
      event.preventDefault();
    }
    router.push(target);
  };

  if (loading) {
    return <span className="mt-2 loading loading-dots loading-xs text-secondary" />;
  }

  if (mobile) {
    return (
      <div className="rounded-box border border-base-300/60 bg-base-200/55 p-2">
        <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide opacity-70">{copy.myAccount}</p>
        {user?.email ? <p className="px-3 pb-1 text-xs opacity-75 truncate">{user.email}</p> : null}
        <ul className="menu w-full p-0 gap-1">
          <li>
            <Link
              href="/dashboard/profile#basic"
              onClick={(event) => handleProfileSectionNavigation('basic', event)}
              className={getHeaderDropdownLinkClass(false)}
            >
              <LuUser className="h-4 w-4" aria-hidden />
              {copy.basic}
            </Link>
          </li>
          <li>
            <Link
              href="/dashboard/profile#api"
              onClick={(event) => handleProfileSectionNavigation('api', event)}
              className={getHeaderDropdownLinkClass(false)}
            >
              <LuKey className="h-4 w-4" aria-hidden />
              {copy.api}
            </Link>
          </li>
          <li>
            <Link
              href="/dashboard/profile#subscription"
              onClick={(event) => handleProfileSectionNavigation('subscription', event)}
              className={getHeaderDropdownLinkClass(false)}
            >
              <LuSubscript className="h-4 w-4" aria-hidden />
              {copy.subscription}
            </Link>
          </li>
          <li>
            <Link
              href="/dashboard/profile#security"
              onClick={(event) => handleProfileSectionNavigation('security', event)}
              className={getHeaderDropdownLinkClass(false)}
            >
              <LuSettings className="h-4 w-4" aria-hidden />
              {copy.security}
            </Link>
          </li>
          <li className="mt-1">
            <button
              onClick={() => {
                onNavigate?.();
                logout();
              }}
              className={`w-full justify-start ${getHeaderDropdownLinkClass(false)} text-error hover:text-error`}
            >
              <LuLogOut className="h-4 w-4" aria-hidden />
              {copy.logout}
            </button>
          </li>
        </ul>
      </div>
    );
  }

  return (
    <details ref={detailsRef} className="dropdown dropdown-end group">
      <summary className={`${headerMenuItemClass} font-normal`} aria-label={copy.openMenu}>
        <LuUser className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">{copy.myAccount}</span>
      </summary>
      <ul className={getHeaderDropdownMenuClass('bottom', 'w-72')}>
        <li>
          <Link
            href="/dashboard/profile#basic"
            onClick={(event) => handleProfileSectionNavigation('basic', event)}
            className={getHeaderDropdownLinkClass(false)}
          >
            <LuUser className="h-4 w-4" aria-hidden />
            {copy.basic}
          </Link>
        </li>
        <li>
          <Link
            href="/dashboard/profile#api"
            onClick={(event) => handleProfileSectionNavigation('api', event)}
            className={getHeaderDropdownLinkClass(false)}
          >
            <LuKey className="h-4 w-4" aria-hidden />
            {copy.api}
          </Link>
        </li>
        <li>
          <Link
            href="/dashboard/profile#subscription"
            onClick={(event) => handleProfileSectionNavigation('subscription', event)}
            className={getHeaderDropdownLinkClass(false)}
          >
            <LuSubscript className="h-4 w-4" aria-hidden />
            {copy.subscription}
          </Link>
        </li>
        <li>
          <Link
            href="/dashboard/profile#security"
            onClick={(event) => handleProfileSectionNavigation('security', event)}
            className={getHeaderDropdownLinkClass(false)}
          >
            <LuSettings className="h-4 w-4" aria-hidden />
            {copy.security}
          </Link>
        </li>
        <li className="mt-1">
          <button onClick={logout} className={`w-full justify-start ${getHeaderDropdownLinkClass(false)} text-error hover:text-error`}>
            <LuLogOut className="h-4 w-4" aria-hidden />
            {copy.logout}
          </button>
        </li>
      </ul>
    </details>
  );
}
