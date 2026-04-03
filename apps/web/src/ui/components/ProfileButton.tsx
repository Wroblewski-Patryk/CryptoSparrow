'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { LuKey, LuLogOut, LuSettings, LuSubscript, LuUser } from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';
import { useDetailsDropdown } from '../hooks/useDetailsDropdown';
import { headerMenuItemClass } from '../layout/dashboard/headerControlStyles';

type ProfileButtonProps = {
  mobile?: boolean;
  onNavigate?: () => void;
};

export default function ProfileButton({ mobile = false, onNavigate }: ProfileButtonProps) {
  const { loading, logout, user } = useAuth();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useDetailsDropdown(detailsRef);

  if (loading) {
    return <span className="mt-2 loading loading-dots loading-xs text-secondary" />;
  }

  if (mobile) {
    return (
      <div className="rounded-box bg-base-100/10 p-2">
        <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide opacity-70">Moje konto</p>
        {user?.email ? <p className="px-3 pb-1 text-xs opacity-75 truncate">{user.email}</p> : null}
        <ul className="menu w-full p-0 gap-1">
          <li>
            <Link href="/dashboard/profile#basic" onClick={onNavigate}>
              <LuUser className="h-4 w-4" aria-hidden />
              Dane podstawowe
            </Link>
          </li>
          <li>
            <Link href="/dashboard/profile#subscription" onClick={onNavigate}>
              <LuSubscript className="h-4 w-4" aria-hidden />
              Subskrypcja
            </Link>
          </li>
          <li>
            <Link href="/dashboard/profile#security" onClick={onNavigate}>
              <LuSettings className="h-4 w-4" aria-hidden />
              Bezpieczenstwo
            </Link>
          </li>
          <li>
            <Link href="/dashboard/profile#api" onClick={onNavigate}>
              <LuKey className="h-4 w-4" aria-hidden />
              Integracje i API keys
            </Link>
          </li>
          <li className="mt-1">
            <button
              onClick={() => {
                onNavigate?.();
                logout();
              }}
              className="text-error"
            >
              <LuLogOut className="h-4 w-4" aria-hidden />
              Wyloguj
            </button>
          </li>
        </ul>
      </div>
    );
  }

  return (
    <details ref={detailsRef} className="dropdown dropdown-end group">
      <summary className={`${headerMenuItemClass} font-normal`} aria-label="Open account menu">
        <LuUser className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Moje konto</span>
      </summary>
      <ul className="menu dropdown-content z-[60] mt-2 w-72 rounded-box bg-base-100 p-2 text-base-content shadow">
        {user?.email && (
          <li className="menu-title">
            <span className="truncate normal-case">{user.email}</span>
          </li>
        )}
        <li className="menu-title">
          <span>Profil</span>
        </li>
        <li>
          <Link href="/dashboard/profile#basic">
            <LuUser className="h-4 w-4" aria-hidden />
            Dane podstawowe
          </Link>
        </li>
        <li>
          <Link href="/dashboard/profile#subscription">
            <LuSubscript className="h-4 w-4" aria-hidden />
            Subskrypcja
          </Link>
        </li>
        <li>
          <Link href="/dashboard/profile#security">
            <LuSettings className="h-4 w-4" aria-hidden />
            Bezpieczenstwo
          </Link>
        </li>

        <li className="menu-title mt-1">
          <span>Integracje</span>
        </li>
        <li>
          <Link href="/dashboard/profile#api">
            <LuKey className="h-4 w-4" aria-hidden />
            Integracje i API keys
          </Link>
        </li>
        <li className="mt-1">
          <button onClick={logout} className="text-error">
            <LuLogOut className="h-4 w-4" aria-hidden />
            Wyloguj
          </button>
        </li>
      </ul>
    </details>
  );
}
