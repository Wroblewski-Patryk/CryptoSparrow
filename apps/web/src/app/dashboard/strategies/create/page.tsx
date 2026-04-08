'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import StrategiesForm from '@/features/strategies/components/StrategyForm';
import { StrategyFormState } from '@/features/strategies/types/StrategyForm.type';
import { createStrategy } from '@/features/strategies/api/strategies.api';
import { handleError } from '@/lib/handleError';
import { LuListChecks } from 'react-icons/lu';
import { useI18n } from '@/i18n/I18nProvider';

export default function StrategiesCreatePage() {
  const { locale, t } = useI18n();
  const router = useRouter();

  const copy = useMemo(
    () =>
      locale === 'pl'
        ? {
            created: 'Strategia utworzona',
            createFailed: 'Blad tworzenia strategii',
            title: 'Nowa strategia',
            breadcrumbStrategies: 'Strategie',
            breadcrumbCreate: 'Tworzenie',
          }
        : {
            created: 'Strategy created',
            createFailed: 'Failed to create strategy',
            title: 'New strategy',
            breadcrumbStrategies: 'Strategies',
            breadcrumbCreate: 'Create',
          },
    [locale]
  );

  const handleCreate = async (form: StrategyFormState) => {
    try {
      const created = await createStrategy(form);
      toast.success(copy.created);
      router.push(`/dashboard/strategies/${created.id}/edit`);
    } catch (error: unknown) {
      toast.error(copy.createFailed, { description: handleError(error) });
    }
  };

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title={copy.title}
        icon={<LuListChecks className='h-5 w-5' />}
        breadcrumb={[
          { label: t('dashboard.common.dashboard'), href: '/dashboard' },
          { label: copy.breadcrumbStrategies, href: '/dashboard/strategies/list' },
          { label: copy.breadcrumbCreate },
        ]}
      />

      <StrategiesForm onSubmit={handleCreate} />
    </section>
  );
}
