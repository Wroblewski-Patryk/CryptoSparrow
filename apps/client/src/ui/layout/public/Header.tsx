'use client';

import Link from 'next/link';
import { LuLayoutDashboard } from 'react-icons/lu';
import { useAuth } from '../../../context/AuthContext';

export default function Header() {
  const { user, loading } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-base-300/60 bg-base-100/80 backdrop-blur">
      <div className="navbar max-w-7xl mx-auto px-4 min-h-16">
        <div className="flex-1">
          <Link href="/" className="flex items-center gap-2 font-heading text-lg tracking-wide text-base-content">
            <span
              aria-hidden
              className="h-8 w-8 bg-current [mask-image:url('/logo.svg')] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
            />
            <span>CryptoSparrow</span>
          </Link>
        </div>
        <div className="flex-none">
          {loading ? (
            <div className="loading loading-dots loading-dots-xs mt-2 text-primary" />
          ) : user ? (
            <Link href="/dashboard" className="btn btn-sm btn-primary">
              <LuLayoutDashboard className="h-4 w-4" aria-hidden />
              Dashboard
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth/login" className="btn btn-sm btn-ghost">
                Login
              </Link>
              <Link href="/auth/register" className="btn btn-sm btn-primary">
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
