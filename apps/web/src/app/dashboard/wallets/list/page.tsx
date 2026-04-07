'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { LuWallet } from 'react-icons/lu';

import { useI18n } from '@/i18n/I18nProvider';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/ViewState';
import WalletsListTable from '@/features/wallets/components/WalletsListTable';
import { listWallets } from '@/features/wallets/services/wallets.service';
import { Wallet } from '@/features/wallets/types/wallet.type';

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  const payload = err.response?.data as { message?: string } | undefined;
  return payload?.message;
};

export default function WalletsListPage() {
  const { locale } = useI18n();
  const router = useRouter();
  const [rows, setRows] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const copy = useMemo(
    () =>
      locale === 'pl'
        ? {
            loadError: 'Nie udalo sie pobrac listy portfeli.',
            title: 'Portfele',
            breadcrumbWallets: 'Portfele',
            breadcrumbList: 'Lista',
            addLabel: 'Dodaj portfel',
            loading: 'Ladowanie portfeli',
            errorTitle: 'Nie udalo sie pobrac portfeli',
            retry: 'Sprobuj ponownie',
            emptyTitle: 'Brak portfeli',
            emptyDescription: 'Dodaj pierwszy portfel, aby przypisywac go do botow.',
          }
        : {
            loadError: 'Could not fetch wallets list.',
            title: 'Wallets',
            breadcrumbWallets: 'Wallets',
            breadcrumbList: 'List',
            addLabel: 'Add wallet',
            loading: 'Loading wallets',
            errorTitle: 'Could not load wallets',
            retry: 'Try again',
            emptyTitle: 'No wallets',
            emptyDescription: 'Add your first wallet to assign it to bots.',
          },
    [locale]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listWallets();
      setRows(data);
    } catch (err) {
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
        title={copy.title}
        icon={<LuWallet className='h-5 w-5' />}
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: copy.breadcrumbWallets, href: '/dashboard/wallets/list' },
          { label: copy.breadcrumbList },
        ]}
        onAdd={() => router.push('/dashboard/wallets/create')}
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
        <WalletsListTable rows={rows} onDeleted={(id) => setRows((prev) => prev.filter((item) => item.id !== id))} />
      ) : null}
    </section>
  );
}
