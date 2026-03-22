'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/ViewState';
import MarketUniversesTable from '@/features/markets/components/MarketUniversesTable';
import { listMarketUniverses } from '@/features/markets/services/markets.service';
import { MarketUniverse } from '@/features/markets/types/marketUniverse.type';

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  const response = err.response?.data as { error?: { message?: string }; message?: string } | undefined;
  return response?.error?.message ?? response?.message;
};

export default function MarketsListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<MarketUniverse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listMarketUniverses();
      setRows(data);
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? 'Nie udalo sie pobrac listy grup rynkow.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title='Grupy rynkow'
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Markets', href: '/dashboard/markets/list' },
          { label: 'List' },
        ]}
        onAdd={() => router.push('/dashboard/markets/create')}
        addLabel='Dodaj grupe rynkow'
      />

      {loading ? <LoadingState title='Ladowanie grup rynkow' /> : null}
      {!loading && error ? (
        <ErrorState title='Nie udalo sie pobrac grup rynkow' description={error} retryLabel='Sprobuj ponownie' onRetry={() => void loadData()} />
      ) : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState title='Brak grup rynkow' description='Dodaj pierwsza grupe, aby wykorzystac ja w botach i backtestach.' />
      ) : null}
      {!loading && !error && rows.length > 0 ? (
        <MarketUniversesTable rows={rows} onDeleted={(id) => setRows((prev) => prev.filter((item) => item.id !== id))} />
      ) : null}
    </section>
  );
}

