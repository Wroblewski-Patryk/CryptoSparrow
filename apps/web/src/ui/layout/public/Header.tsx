'use client';

import Link from 'next/link';
import { LuLayoutDashboard, LuShieldCheck } from 'react-icons/lu';
import { useAuth } from '../../../context/AuthContext';
import { useI18n } from '../../../i18n/I18nProvider';
import AppLogoLink from '../../components/AppLogoLink';

export default function Header() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const showDashboardCta = !loading && Boolean(user);
  const showAdminCta = showDashboardCta && user?.role === 'ADMIN';
  const headerActionPrimaryClass =
    'btn btn-xs h-7 min-h-7 border transition-colors duration-150 border-primary/45 bg-primary/10 text-primary hover:border-primary/70 hover:bg-primary/20';
  const headerActionSecondaryClass =
    'btn btn-xs h-7 min-h-7 border transition-colors duration-150 border-base-content/35 bg-base-100/70 text-base-content/80 hover:border-base-content/60 hover:bg-base-100';

  return (
    <header className="sticky top-0 z-50 border-b border-base-300/60 bg-base-100/80 backdrop-blur">
      <div className="navbar max-w-7xl mx-auto px-4 min-h-16">
        <div className="flex-1">
          <AppLogoLink href="/" className="text-lg text-base-content" />
        </div>
        <div className="flex-none">
          {showDashboardCta ? (
            <div className="flex items-center gap-2">
              <Link href="/dashboard" className={`${headerActionPrimaryClass} gap-1.5`}>
                <LuLayoutDashboard className="h-4 w-4" aria-hidden />
                {t('public.shell.dashboard')}
              </Link>
              {showAdminCta ? (
                <Link href="/admin" className={`${headerActionPrimaryClass} gap-1.5`}>
                  <LuShieldCheck className="h-4 w-4" aria-hidden />
                  {t('public.shell.admin')}
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth/login" className={headerActionSecondaryClass}>
                {t('public.shell.login')}
              </Link>
              <Link href="/auth/register" className={headerActionPrimaryClass}>
                {t('public.shell.register')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
