'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
  const { t } = useI18n();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const saveLabel = t('dashboard.strategies.saveLabel');
  const savingLabel = t('dashboard.strategies.page.saving');

  const handleCreate = async (form: StrategyFormState) => {
    const createdMessage = t('dashboard.strategies.page.created');
    const createFailedMessage = t('dashboard.strategies.page.createFailed');

    try {
      await runAsyncWithState(setSubmitting, async () => {
        const created = await createStrategy(form);
        toast.success(createdMessage);
        router.push(`/dashboard/strategies/${created.id}/edit`);
      });
    } catch (error: unknown) {
      toast.error(createFailedMessage, {
        description: resolveUiErrorMessage(error, { fallback: createFailedMessage }),
      });
    }
  };

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title={t('dashboard.strategies.title')}
        icon={<LuListChecks className='h-5 w-5' />}
        breadcrumb={[
          { label: t('dashboard.common.dashboard'), href: '/dashboard' },
          { label: t('dashboard.strategies.title'), href: '/dashboard/strategies/list' },
          { label: t('dashboard.strategies.createLabel'), icon: <LuPlus className='h-3.5 w-3.5' /> },
        ]}
        actions={
          <button
            type='submit'
            form={STRATEGY_FORM_ID}
            className={PAGE_TITLE_ACTION_SAVE_CLASS}
            disabled={submitting}
          >
            <LuSave className='h-4 w-4' />
            {submitting ? savingLabel : saveLabel}
          </button>
        }
      />

      <StrategiesForm formId={STRATEGY_FORM_ID} onSubmit={handleCreate} submitting={submitting} />
    </section>
  );
}
