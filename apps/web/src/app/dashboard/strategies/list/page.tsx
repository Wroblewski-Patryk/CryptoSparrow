'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import StrategiesList from '@/features/strategies/components/StrategiesList';
import { LuListChecks } from 'react-icons/lu';
import { useI18n } from '@/i18n/I18nProvider';

export default function StrategiesListPage() {
  const { locale, t } = useI18n();
  const router = useRouter();

  const copy = useMemo(
    () =>
      locale === 'pl'
        ? {
            title: 'Strategie',
            breadcrumbStrategies: 'Strategie',
            breadcrumbList: 'Lista',
            addLabel: 'Nowa strategia',
          }
        : {
            title: 'Strategies',
            breadcrumbStrategies: 'Strategies',
            breadcrumbList: 'List',
            addLabel: 'New strategy',
          },
    [locale]
  );

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title={copy.title}
        icon={<LuListChecks className='h-5 w-5' />}
        breadcrumb={[
          { label: t('dashboard.common.dashboard'), href: '/dashboard' },
          { label: copy.breadcrumbStrategies, href: '/dashboard/strategies/list' },
          { label: copy.breadcrumbList },
        ]}
        onAdd={() => router.push('/dashboard/strategies/create')}
        addLabel={copy.addLabel}
      />

      <StrategiesList />
    </section>
  );
}
