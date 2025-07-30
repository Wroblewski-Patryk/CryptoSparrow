'use client';
import Link from 'next/link';
import ProfileButton from '../../../features/profile/components/ProfileButton';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 shadow-md">
      <div className="navbar max-w-7xl mx-auto px-6 py-4">
        {/* Logo */}
        <div className="flex-1">
          <Link href="/" className="flex items-center text-xl font-headline font-bold text-gray-900 dark:text-white">
            <img src="/logo.png" alt="Logotype - CryptoSparrow" className="h-8 w-8 mr-2" />
            CryptoSparrow
          </Link>
        </div>

        {/* Nawigacja */}
        <div className="flex-none">
          <ul className="menu menu-horizontal px-1">
            <li><Link href="/dashboard/strategies">Strategie</Link></li>
            <li><Link href="/dashboard/backtest">Analiza wsteczna</Link></li>
            <li><Link href="/dashboard/automation">Automatyzacja(boty)</Link></li>
          </ul>
        </div>

        {/* Profile */}
        <div className="flex-none ml-4">
          <ProfileButton />
        </div>
      </div>
    </header>
  );
}
