'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LuList, LuWallet } from 'react-icons/lu';

import { useI18n } from '@/i18n/I18nProvider';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/ViewState';
import WalletsListTable from '@/features/wallets/components/WalletsListTable';
import { listWallets } from '@/features/wallets/services/wallets.service';
import { Wallet } from '@/features/wallets/types/wallet.type';
import { dashboardRoutes } from '@/ui/layout/dashboard/dashboardRoutes';
import { runAsyncWithState } from '@/lib/async';
import { resolveUiErrorMessage } from '@/lib/errorResolver';

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
            addLabel: 'Create',
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
            addLabel: 'Create',
            loading: 'Loading wallets',
            errorTitle: 'Could not load wallets',
            retry: 'Try again',
            emptyTitle: 'No wallets',
            emptyDescription: 'Add your first wallet to assign it to bots.',
          },
    [locale]
  );

  const loadData = useCallback(async () => {
    setError(null);
    try {
      await runAsyncWithState(setLoading, async () => {
        const data = await listWallets();
        setRows(data);
      });
    } catch (err) {
      setError(resolveUiErrorMessage(err, { fallback: copy.loadError }) ?? copy.loadError);
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
          { label: copy.breadcrumbWallets, href: dashboardRoutes.wallets.list },
          { label: copy.breadcrumbList, icon: <LuList className='h-3.5 w-3.5' /> },
        ]}
        onAdd={() => router.push(dashboardRoutes.wallets.create)}
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
