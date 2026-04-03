'use client';

import { useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/ViewState';
import BacktestsRunsTable from './BacktestsRunsTable';
import { listBacktestRuns } from '../services/backtests.service';
import { BacktestRun } from '../types/backtest.type';
import { I18nContext } from '../../../i18n/I18nProvider';

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  return (err.response?.data as { message?: string } | undefined)?.message;
};

export default function BacktestsListView() {
  const i18n = useContext(I18nContext);
  const locale = i18n?.locale === 'en' ? 'en' : 'pl';
  const copy =
    locale === 'en'
      ? {
          loadErrorDefault: 'Could not load backtest list.',
          loadingTitle: 'Loading backtest list',
          errorTitle: 'Could not load backtest list',
          retry: 'Try again',
          emptyTitle: 'No backtest runs',
          emptyDescription: 'Create the first run to browse results.',
        }
      : {
          loadErrorDefault: 'Nie udalo sie pobrac listy backtestow.',
          loadingTitle: 'Ladowanie listy backtestow',
          errorTitle: 'Nie udalo sie pobrac listy backtestow',
          retry: 'Sprobuj ponownie',
          emptyTitle: 'Brak runow backtestu',
          emptyDescription: 'Utworz pierwszy run, aby przejrzec wyniki.',
        };
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

  if (loading) return <LoadingState title={copy.loadingTitle} />;
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

  return <BacktestsRunsTable rows={rows} />;
}

