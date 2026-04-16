'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_TITLE_ACTION_SAVE_CLASS, PageTitle } from '@/ui/layout/dashboard/PageTitle';
import StrategiesForm from '@/features/strategies/components/StrategyForm';
import { StrategyFormState } from '@/features/strategies/types/StrategyForm.type';
import { createStrategy } from '@/features/strategies/api/strategies.api';
import { runAsyncWithState } from '@/lib/async';
import { resolveUiErrorMessage } from '@/lib/errorResolver';
import { LuListChecks, LuPlus, LuSave } from 'react-icons/lu';
import { useI18n } from '@/i18n/I18nProvider';

const STRATEGY_FORM_ID = 'strategy-form-create';

export default function StrategiesCreatePage() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const copy = useMemo(
    () => ({
      en: {
        created: 'Strategy created',
        createFailed: 'Failed to create strategy',
        title: 'Strategies',
        save: 'Save',
        breadcrumbStrategies: 'Strategies',
        breadcrumbCreate: 'Create',
      },
      pl: {
        created: 'Strategia utworzona',
        createFailed: 'Blad tworzenia strategii',
        title: 'Strategie',
        save: 'Save',
        breadcrumbStrategies: 'Strategie',
        breadcrumbCreate: 'Tworzenie',
      },
      pt: {
        created: 'Estrategia criada',
        createFailed: 'Falha ao criar estrategia',
        title: 'Estrategias',
        save: 'Save',
        breadcrumbStrategies: 'Estrategias',
        breadcrumbCreate: 'Criar',
      },
    } as const)[locale],
    [locale]
  );

  const handleCreate = async (form: StrategyFormState) => {
    try {
      await runAsyncWithState(setSubmitting, async () => {
        const created = await createStrategy(form);
        toast.success(copy.created);
        router.push(`/dashboard/strategies/${created.id}/edit`);
      });
    } catch (error: unknown) {
      toast.error(copy.createFailed, {
        description: resolveUiErrorMessage(error, { fallback: copy.createFailed }),
      });
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
          { label: copy.breadcrumbCreate, icon: <LuPlus className='h-3.5 w-3.5' /> },
        ]}
        actions={
          <button
            type='submit'
            form={STRATEGY_FORM_ID}
            className={PAGE_TITLE_ACTION_SAVE_CLASS}
            disabled={submitting}
          >
            <LuSave className='h-4 w-4' />
            {copy.save}
          </button>
        }
      />

      <StrategiesForm formId={STRATEGY_FORM_ID} onSubmit={handleCreate} />
    </section>
  );
}
