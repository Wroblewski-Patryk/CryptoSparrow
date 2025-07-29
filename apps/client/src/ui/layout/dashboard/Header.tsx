'use client';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { LuLayoutDashboard, LuLogOut } from 'react-icons/lu';

export default function Header() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 shadow-md">
      <div className="container mx-auto flex justify-between items-center px-6 py-4">
        <Link href="/" className="text-xl font-headline font-bold text-gray-900 dark:text-white">
          <img src="/logo.png" alt="Logotype - CryptoSparrow" className="h-8 w-8 mr-2 float-left" />
          CryptoSparrow
        </Link>
        <nav>
          <ul className="flex space-x-4">
            <li>
              <Link
                href="/dashboard"
                className="text-sm text-gray-100 hover:underline"
              >
                <LuLayoutDashboard className="inline mr-2 mb-1" />
                Dashboard
              </Link>
            </li>
            <li>
              <button
                onClick={logout}
                className="text-sm text-gray-100 hover:underline"
                >
                <LuLogOut className="inline mr-2 mb-1" />
                Wyloguj
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}