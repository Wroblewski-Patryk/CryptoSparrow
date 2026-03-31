'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import { LoadingState } from '@/ui/components/ViewState';
import SafetyBar from '@/ui/layout/dashboard/SafetyBar';
import RiskNoticeFooter from '@/ui/layout/dashboard/RiskNoticeFooter';
import HomeLiveWidgets from '@/features/dashboard-home/components/HomeLiveWidgets';

const PRIMARY_ACTION_CLASS =
  'btn btn-primary btn-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';
const SECONDARY_ACTION_CLASS =
  'btn btn-outline btn-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return <LoadingState title='Ladowanie panelu dashboard' />;
  }

  return (
    <section className='w-full'>
      <PageTitle
        title='Control Center'
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Control Center' },
        ]}
      />

      <SafetyBar mode='PAPER' />

      <div className='mb-6 rounded-lg border border-base-300 bg-base-200 p-4'>
        <div className='grid gap-3 md:grid-cols-2 2xl:grid-cols-3'>
          <div className='rounded-md border border-base-300 bg-base-100 p-3'>
            <div className='flex h-full flex-col'>
              <p className='text-[11px] uppercase tracking-wide opacity-60'>Kontekst operatora</p>
              <p className='mt-1 text-sm font-medium'>{user?.email ?? "-"}</p>
              <p className='mt-auto pt-2 text-xs opacity-65'>Aktywna sesja dashboardu globalnego</p>
            </div>
          </div>

          <div className='rounded-md border border-base-300 bg-base-100 p-3'>
            <div className='flex h-full flex-col'>
              <p className='text-[11px] uppercase tracking-wide opacity-60'>Podzial modulow</p>
              <p className='mt-1 text-sm opacity-80'>
                Dashboard = widok globalny. Boty = operacje runtime, otwarte pozycje, historia i live-check sygnalow.
              </p>
              <Link href='/dashboard/bots' className={`mt-auto inline-block pt-2 text-sm font-medium ${SECONDARY_ACTION_CLASS}`}>
                Otworz Operacje Botow
              </Link>
            </div>
          </div>

          <div className='rounded-md border border-base-300 bg-base-100 p-3 md:col-span-2 2xl:col-span-1'>
            <div className='flex h-full flex-col'>
              <p className='text-[11px] uppercase tracking-wide opacity-60'>Sugerowany start</p>
              <div className='mt-auto flex flex-wrap gap-2 pt-2'>
                <Link href='/dashboard/bots' className={PRIMARY_ACTION_CLASS}>
                  <span className='badge badge-primary badge-xs border-0'>Glowny</span>
                  Boty runtime
                </Link>
                <Link href='/dashboard/backtests/list' className={SECONDARY_ACTION_CLASS}>
                  <span className='badge badge-ghost badge-xs border-base-300'>Pomocniczy</span>
                  Backtesty
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <HomeLiveWidgets />

      <RiskNoticeFooter />
    </section>
  );
}

