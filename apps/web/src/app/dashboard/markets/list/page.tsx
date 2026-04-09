'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/ViewState';
import MarketUniversesTable from '@/features/markets/components/MarketUniversesTable';
import { listMarketUniverses } from '@/features/markets/services/markets.service';
import { MarketUniverse } from '@/features/markets/types/marketUniverse.type';
import { LuChartCandlestick, LuList } from 'react-icons/lu';
import { useI18n } from '@/i18n/I18nProvider';

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  const response = err.response?.data as { error?: { message?: string }; message?: string } | undefined;
  return response?.error?.message ?? response?.message;
};

export default function MarketsListPage() {
  const { locale } = useI18n();
  const router = useRouter();
  const [rows, setRows] = useState<MarketUniverse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const copy = useMemo(
    () =>
      locale === 'pl'
        ? {
            loadError: 'Nie udalo sie pobrac listy grup rynkow.',
            breadcrumbMarkets: 'Rynki',
            breadcrumbList: 'Lista',
            addLabel: 'Create',
            loading: 'Ladowanie grup rynkow',
            errorTitle: 'Nie udalo sie pobrac grup rynkow',
            retry: 'Sprobuj ponownie',
            emptyTitle: 'Brak grup rynkow',
            emptyDescription: 'Dodaj pierwsza grupe, aby wykorzystac ja w botach i backtestach.',
          }
        : {
            loadError: 'Could not fetch markets list.',
            breadcrumbMarkets: 'Markets',
            breadcrumbList: 'List',
            addLabel: 'Create',
            loading: 'Loading markets',
            errorTitle: 'Could not load markets',
            retry: 'Try again',
            emptyTitle: 'No markets',
            emptyDescription: 'Add your first market set to use it in bots and backtests.',
          },
    [locale]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listMarketUniverses();
      setRows(data);
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title={copy.breadcrumbMarkets}
        icon={<LuChartCandlestick className='h-5 w-5' />}
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: copy.breadcrumbMarkets, href: '/dashboard/markets/list' },
          { label: copy.breadcrumbList, icon: <LuList className='h-3.5 w-3.5' /> },
        ]}
        onAdd={() => router.push('/dashboard/markets/create')}
        addLabel={copy.addLabel}
      />

      {loading ? <LoadingState title={copy.loading} /> : null}
      {!loading && error ? (
        <ErrorState title={copy.errorTitle} description={error} retryLabel={copy.retry} onRetry={() => void loadData()} />
      ) : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
      ) : null}
      {!loading && !error && rows.length > 0 ? (
        <MarketUniversesTable rows={rows} onDeleted={(id) => setRows((prev) => prev.filter((item) => item.id !== id))} />
      ) : null}
    </section>
  );
}
