'use client';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { LuLayoutDashboard,LuLogOut } from "react-icons/lu";
import ProfileButton from '../../../features/profile/components/ProfileButton';

export default function Header() {
  const { user, loading, logout } = useAuth();

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
        <nav>
          <ul className="flex">
            { loading ? (
              <div className="loading loading-spinner text-primary"></div>
            ) : user ? (
              <>
                <li>
                  <Link
                    href="/dashboard"
                    className="flex px-4 py-2 hover:bg-gray-800 rounded"
                    >
                    <LuLayoutDashboard className="inline mr-2 mt-1" />
                    Dashboard
                  </Link>
                </li>
                <li>
                  <ProfileButton/>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link
                    href="/auth/login"
                    className="text-sm text-gray-100 hover:underline"
                    >
                    Zaloguj się
                  </Link>
                </li>
                <li>
                  <Link
                    href="/auth/register"
                    className="text-sm text-gray-900 bg-gray-100 px-4 py-2 rounded hover:bg-gray-300 transition"
                    >
                    Rejestracja
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}