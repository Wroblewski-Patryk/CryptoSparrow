'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorState } from '@/ui/components/ViewState';
import { SkeletonKpiRow, SkeletonTableRows } from '@/ui/components/loading';
import BacktestsRunsTable from './BacktestsRunsTable';
import { listBacktestRuns } from '../services/backtests.service';
import { BacktestRun } from '../types/backtest.type';
import { useI18n } from '../../../i18n/I18nProvider';
import { getAxiosMessage } from '@/lib/getAxiosMessage';

export default function BacktestsListView() {
  const { t } = useI18n();
  const copy = useMemo(
    () => ({
      loadErrorDefault: t('dashboard.backtests.listView.loadErrorDefault'),
      loadingTitle: t('dashboard.backtests.listView.loadingTitle'),
      errorTitle: t('dashboard.backtests.listView.errorTitle'),
      retry: t('dashboard.backtests.listView.retry'),
      emptyTitle: t('dashboard.backtests.listView.emptyTitle'),
      emptyDescription: t('dashboard.backtests.listView.emptyDescription'),
    }),
    [t]
  );
  const [rows, setRows] = useState<BacktestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBacktestRuns();
      setRows(data);
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? copy.loadErrorDefault);
    } finally {
      setLoading(false);
    }
  }, [copy.loadErrorDefault]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className='space-y-3'>
        <span className='sr-only'>{copy.loadingTitle}</span>
        <SkeletonKpiRow items={3} />
        <SkeletonTableRows columns={6} rows={7} title={false} className='border-base-300/40 bg-base-100/60 p-3' />
      </div>
    );
  }
  if (error) {
    return (
      <ErrorState
        title={copy.errorTitle}
        description={error}
        retryLabel={copy.retry}
        onRetry={() => void loadData()}
      />
    );
  }
  if (rows.length === 0) {
    return <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />;
  }

  return <BacktestsRunsTable rows={rows} onDeleted={(id) => setRows((prev) => prev.filter((row) => row.id !== id))} />;
}

