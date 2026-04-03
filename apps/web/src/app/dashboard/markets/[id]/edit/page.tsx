'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import { ErrorState, LoadingState } from '@/ui/components/ViewState';
import MarketUniverseForm from '@/features/markets/components/MarketUniverseForm';
import { getMarketUniverse, updateMarketUniverse } from '@/features/markets/services/markets.service';
import { CreateMarketUniverseInput, MarketUniverse } from '@/features/markets/types/marketUniverse.type';
import { handleError } from '@/lib/handleError';
import { LuChartCandlestick } from 'react-icons/lu';
import { useI18n } from '@/i18n/I18nProvider';

const MARKET_UNIVERSE_ACTIVE_BOT_ERROR = 'market universe is used by active bot and cannot be edited';

export default function MarketsEditPage() {
  const { locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [initial, setInitial] = useState<MarketUniverse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = useMemo(
    () =>
      locale === 'pl'
        ? {
            updated: 'Grupa rynkow zaktualizowana',
            activeBotTitle: 'Grupa rynkow jest aktualnie uzywana przez aktywnego bota',
            activeBotDescription: 'Wylacz bota, a potem zapisz zmiany.',
            saveFailed: 'Nie udalo sie zapisac zmian',
            titleFallback: 'Edycja grupy rynkow',
            titlePrefix: 'Edytuj:',
            breadcrumbMarkets: 'Rynki',
            breadcrumbEdit: 'Edycja',
            loading: 'Ladowanie grupy rynkow',
            errorTitle: 'Nie udalo sie pobrac grupy rynkow',
            backToList: 'Powrot do listy',
            submitLabel: 'Zapisz zmiany',
          }
        : {
            updated: 'Market group updated',
            activeBotTitle: 'Market group is currently used by an active bot',
            activeBotDescription: 'Disable the bot and then save changes.',
            saveFailed: 'Could not save changes',
            titleFallback: 'Edit market group',
            titlePrefix: 'Edit:',
            breadcrumbMarkets: 'Markets',
            breadcrumbEdit: 'Edit',
            loading: 'Loading market group',
            errorTitle: 'Could not load market group',
            backToList: 'Back to list',
            submitLabel: 'Save changes',
          },
    [locale]
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getMarketUniverse(id);
        setInitial(data);
      } catch (err: unknown) {
        setError(handleError(err));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  const handleUpdate = async (payload: CreateMarketUniverseInput) => {
    setSubmitting(true);
    try {
      const updated = await updateMarketUniverse(id, payload);
      setInitial(updated);
      toast.success(copy.updated);
    } catch (err: unknown) {
      const message = handleError(err);
      if (message === MARKET_UNIVERSE_ACTIVE_BOT_ERROR) {
        toast.error(copy.activeBotTitle, { description: copy.activeBotDescription });
      } else {
        toast.error(copy.saveFailed, { description: message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title={initial ? `${copy.titlePrefix} ${initial.name}` : copy.titleFallback}
        icon={<LuChartCandlestick className='h-5 w-5' />}
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: copy.breadcrumbMarkets, href: '/dashboard/markets/list' },
          { label: copy.breadcrumbEdit },
        ]}
      />

      {loading ? <LoadingState title={copy.loading} /> : null}
      {!loading && error ? (
        <ErrorState
          title={copy.errorTitle}
          description={error}
          retryLabel={copy.backToList}
          onRetry={() => router.push('/dashboard/markets/list')}
        />
      ) : null}
      {!loading && !error && initial ? (
        <MarketUniverseForm
          mode='edit'
          initial={initial}
          submitLabel={copy.submitLabel}
          submitting={submitting}
          onSubmit={handleUpdate}
        />
      ) : null}
    </section>
  );
}

