'use client';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { LuLayoutDashboard } from "react-icons/lu";
import ProfileButton from '../../components/ProfileButton';
import ThemeSwitcher from '../../components/ThemeSwitch';

export default function Header() {
  const { user, loading } = useAuth();

  return (
    <header className="bg-primary sticky top-0 z-50 shadow-sm">
      <div className="navbar max-w-7xl mx-auto">
        <div className="flex-1">
          <Link href="/" className="flex items-center font-headlinedark:text-white">
            <img src="/logo.png" alt="Logotype - CryptoSparrow" className="h-8 w-8 mr-2" />
            CryptoSparrow
          </Link>
        </div>
        <div className="flex-none"> 
          { loading ? (
          <div className="loading loading-dots loading-dots-xs mt-2 text-primary"></div>
          ) : user ? (
            <ul className="menu menu-horizontal px-1">
              <li><Link href="/dashboard"><LuLayoutDashboard/> Dashboard</Link></li>
              <li className="ml-4"><ProfileButton /></li>
            </ul>
          ) : ( 
          <ul className="menu menu-horizontal px-1">
            <li><Link href="/auth/login">Zaloguj się</Link></li>
            <li><Link href="/auth/register">Rejestracja</Link></li>
          </ul>
          )}
          <ul className="menu menu-horizontal px-1">
            <li><ThemeSwitcher /></li>
          </ul>
        </div>
      </div>
    </header>
  );
}