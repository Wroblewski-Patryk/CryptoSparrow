'use client';

import { useRouter } from 'next/navigation';
import { PageTitle } from 'apps/client/src/ui/layout/dashboard/PageTitle';
import StrategiesList from 'apps/client/src/features/strategies/components/StrategiesList';

export default function StrategiesListPage() {
  const router = useRouter();

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title='Strategie'
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Strategies', href: '/dashboard/strategies/list' },
          { label: 'List' },
        ]}
        onAdd={() => router.push('/dashboard/strategies/create')}
        addLabel='Nowa strategia'
      />

      <StrategiesList />
    </section>
  );
}
