'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import StrategiesForm from '@/features/strategies/components/StrategyForm';
import { getStrategy, updateStrategy } from '@/features/strategies/api/strategies.api';
import { StrategyFormState } from '@/features/strategies/types/StrategyForm.type';
import { dtoToForm } from '@/features/strategies/utils/StrategyForm.map';
import { handleError } from '@/lib/handleError';
import { ErrorState, LoadingState } from '@/ui/components/ViewState';
import { LuListChecks } from 'react-icons/lu';
import { useI18n } from '@/i18n/I18nProvider';

const STRATEGY_USED_BY_ACTIVE_BOT_ERROR = 'strategy is used by active bot and cannot be edited';

export default function StrategiesEditPage() {
  const { locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [initial, setInitial] = useState<StrategyFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const copy = useMemo(
    () =>
      locale === 'pl'
        ? {
            updated: 'Strategia zaktualizowana',
            activeBotTitle: 'Strategia jest aktualnie uzywana przez aktywnego bota',
            activeBotDescription: 'Wylacz bota lub ustaw go jako nieaktywny przed edycja strategii.',
            saveFailed: 'Blad zapisu strategii',
            titleFallback: 'Edycja strategii',
            breadcrumbStrategies: 'Strategie',
            breadcrumbEdit: 'Edycja',
            addLabel: 'Nowa strategia',
            loading: 'Ladowanie strategii',
            errorTitle: 'Nie udalo sie pobrac strategii',
            backToList: 'Powrot do listy',
          }
        : {
            updated: 'Strategy updated',
            activeBotTitle: 'Strategy is currently used by an active bot',
            activeBotDescription: 'Disable the bot or set it inactive before editing strategy.',
            saveFailed: 'Failed to save strategy',
            titleFallback: 'Edit strategy',
            breadcrumbStrategies: 'Strategies',
            breadcrumbEdit: 'Edit',
            addLabel: 'New strategy',
            loading: 'Loading strategy',
            errorTitle: 'Could not load strategy',
            backToList: 'Back to list',
          },
    [locale]
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getStrategy(id);
        setInitial(dtoToForm(data));
      } catch (err: unknown) {
        setError(handleError(err));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id]);

  const handleUpdate = async (form: StrategyFormState) => {
    try {
      await updateStrategy(id, form);
      toast.success(copy.updated);
    } catch (error: unknown) {
      const message = handleError(error);
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
        title={initial ? initial.name : copy.titleFallback}
        icon={<LuListChecks className='h-5 w-5' />}
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: copy.breadcrumbStrategies, href: '/dashboard/strategies/list' },
          { label: copy.breadcrumbEdit },
        ]}
        onAdd={() => router.push('/dashboard/strategies/create')}
        addLabel={copy.addLabel}
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
      {!loading && !error && initial ? <StrategiesForm initial={initial} onSubmit={handleUpdate} /> : null}
    </section>
  );
}

