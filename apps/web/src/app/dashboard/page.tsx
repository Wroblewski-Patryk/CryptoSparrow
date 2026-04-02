'use client';
import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import { LoadingState } from '@/ui/components/ViewState';
import HomeLiveWidgets from '@/features/dashboard-home/components/HomeLiveWidgets';
import { useI18n } from '@/i18n/I18nProvider';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return <LoadingState title={t('dashboard.home.runtime.loadingTitle')} />;
  }

  return (
    <section className='w-full'>
      <PageTitle
        title={t('dashboard.home.pageTitle')}
        breadcrumb={[
          { label: t('dashboard.common.dashboard'), href: '/dashboard' },
          { label: t('dashboard.home.pageBreadcrumb') },
        ]}
      />

      <HomeLiveWidgets />
    </section>
  );
}

