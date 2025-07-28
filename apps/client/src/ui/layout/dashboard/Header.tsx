import Link from 'next/link';
import { LuLayoutDashboard, LuLogOut } from 'react-icons/lu';

export default function Header() {
  
  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 shadow-md">
      <div className="container mx-auto flex justify-between items-center px-6 py-4">
        <Link href="/" className="text-xl font-bold text-gray-900 dark:text-white">
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
              <Link
                href="/auth/logout"
                className="text-sm text-gray-100 hover:underline"
              >
                <LuLogOut className="inline mr-2 mb-1" />
                Wyloguj
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}