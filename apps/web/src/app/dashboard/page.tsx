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

      <div className='alert mb-6'>
        <span>Signed in as {user?.email}</span>
      </div>
      <div className='alert mb-6 border border-base-300 bg-base-200 text-sm'>
        <span>
          Dashboard to globalny panel sterowania aplikacja. Operacyjny runtime botow (otwarte pozycje, historia, live
          check sygnalow) znajdziesz w{" "}
          <Link href='/dashboard/bots' className='link link-primary font-medium'>
            Bots Operations Center
          </Link>
          .
        </span>
      </div>

      <HomeLiveWidgets />

      <RiskNoticeFooter />
    </section>
  );
}

