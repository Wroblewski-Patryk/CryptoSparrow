'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PAGE_TITLE_ACTION_SAVE_CLASS, PageTitle } from '@/ui/layout/dashboard/PageTitle';
import StrategiesForm from '@/features/strategies/components/StrategyForm';
import { getStrategy, updateStrategy } from '@/features/strategies/api/strategies.api';
import { StrategyFormState } from '@/features/strategies/types/StrategyForm.type';
import { dtoToForm } from '@/features/strategies/utils/StrategyForm.map';
import { runAsyncWithState } from '@/lib/async';
import { resolveUiErrorMessage } from '@/lib/errorResolver';
import { ErrorState, LoadingState } from '@/ui/components/ViewState';
import { LuListChecks, LuPencilLine, LuSave } from 'react-icons/lu';
import { useI18n } from '@/i18n/I18nProvider';

const STRATEGY_USED_BY_ACTIVE_BOT_ERROR = 'strategy is used by active bot and cannot be edited';
const STRATEGY_FORM_ID = 'strategy-form-edit';

export default function StrategiesEditPage() {
  const { locale, t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [initial, setInitial] = useState<StrategyFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = useMemo(
    () => ({
      en: {
        updated: 'Strategy updated',
        activeBotTitle: 'Strategy is currently used by an active bot',
        activeBotDescription: 'Disable the bot or set it inactive before editing strategy.',
        saveFailed: 'Failed to save strategy',
        save: 'Save',
        titleFallback: 'Strategies',
        breadcrumbStrategies: 'Strategies',
        breadcrumbEdit: 'Edit',
        loading: 'Loading strategy',
        errorTitle: 'Could not load strategy',
        backToList: 'Back to list',
        updatePrefix: 'Update:',
      },
      pl: {
        updated: 'Strategia zaktualizowana',
        activeBotTitle: 'Strategia jest aktualnie uzywana przez aktywnego bota',
        activeBotDescription: 'Wylacz bota lub ustaw go jako nieaktywny przed edycja strategii.',
        saveFailed: 'Blad zapisu strategii',
        save: 'Save',
        titleFallback: 'Strategie',
        breadcrumbStrategies: 'Strategie',
        breadcrumbEdit: 'Edycja',
        loading: 'Ladowanie strategii',
        errorTitle: 'Nie udalo sie pobrac strategii',
        backToList: 'Powrot do listy',
        updatePrefix: 'Aktualizacja:',
      },
      pt: {
        updated: 'Estrategia atualizada',
        activeBotTitle: 'A estrategia esta a ser usada por um bot ativo',
        activeBotDescription: 'Desativa o bot ou marca-o inativo antes de editar.',
        saveFailed: 'Falha ao guardar estrategia',
        save: 'Save',
        titleFallback: 'Estrategias',
        breadcrumbStrategies: 'Estrategias',
        breadcrumbEdit: 'Editar',
        loading: 'A carregar estrategia',
        errorTitle: 'Nao foi possivel carregar estrategia',
        backToList: 'Voltar a lista',
        updatePrefix: 'Atualizacao:',
      },
    } as const)[locale],
    [locale]
  );

  useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        await runAsyncWithState(setLoading, async () => {
          const data = await getStrategy(id);
          setInitial(dtoToForm(data));
        });
      } catch (err: unknown) {
        setError(resolveUiErrorMessage(err, { fallback: copy.errorTitle }) ?? copy.errorTitle);
      }
    };

    void load();
  }, [copy.errorTitle, id]);

  const handleUpdate = async (form: StrategyFormState) => {
    try {
      await runAsyncWithState(setSubmitting, async () => {
        await updateStrategy(id, form);
        toast.success(copy.updated);
      });
    } catch (error: unknown) {
      const message = resolveUiErrorMessage(error, { fallback: copy.saveFailed }) ?? copy.saveFailed;
      if (message === STRATEGY_USED_BY_ACTIVE_BOT_ERROR) {
        toast.error(copy.activeBotTitle, { description: copy.activeBotDescription });
        return;
      }

      toast.error(copy.saveFailed, { description: message });
    }
  };

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title={copy.titleFallback}
        icon={<LuListChecks className='h-5 w-5' />}
        breadcrumb={[
          { label: t('dashboard.common.dashboard'), href: '/dashboard' },
          { label: copy.breadcrumbStrategies, href: '/dashboard/strategies/list' },
          {
            label: initial ? `${copy.updatePrefix} ${initial.name}` : copy.breadcrumbEdit,
            icon: <LuPencilLine className='h-3.5 w-3.5' />,
          },
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

      {loading ? <LoadingState title={copy.loading} /> : null}
      {!loading && error ? (
        <ErrorState
          title={copy.errorTitle}
          description={error}
          retryLabel={copy.backToList}
          onRetry={() => router.push('/dashboard/strategies/list')}
        />
      ) : null}
      {!loading && !error && initial ? <StrategiesForm formId={STRATEGY_FORM_ID} initial={initial} onSubmit={handleUpdate} /> : null}
    </section>
  );
}
