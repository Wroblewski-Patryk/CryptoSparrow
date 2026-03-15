'use client';
import Link from 'next/link';

import ProfileButton from '../../components/ProfileButton';
import ThemeSwitcher from '../../components/ThemeSwitch';

export default function Header() {
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
            <li><Link href="/dashboard/markets">Markets</Link></li>
            <li><Link href="/dashboard/builder">Builder</Link></li>
            <li><Link href="/dashboard/strategies">Strategie</Link></li>
            <li><Link href="/dashboard/backtest">Analiza wsteczna</Link></li>
            <li><Link href="/dashboard/automation">Automatyzacja(boty)</Link></li>
          </ul>
          <ul className="menu menu-horizontal px-1">
            <li className="ml-4"><ProfileButton /></li>
          </ul>
          <ul className="menu menu-horizontal px-1">
            <li><ThemeSwitcher /></li>
          </ul>
        </div>
      </div>
    </header>
  );
}
