'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { EmptyState, ErrorState, LoadingState } from 'apps/client/src/ui/components/ViewState';
import BacktestsRunsTable from './BacktestsRunsTable';
import { listBacktestRuns } from '../services/backtests.service';
import { BacktestRun, BacktestStatus } from '../types/backtest.type';

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  return (err.response?.data as { message?: string } | undefined)?.message;
};

export default function BacktestsListView() {
  const [rows, setRows] = useState<BacktestRun[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<BacktestStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBacktestRuns(selectedStatus === 'ALL' ? undefined : selectedStatus);
      setRows(data);
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? 'Nie udalo sie pobrac listy backtestow.');
    } finally {
      setLoading(false);
    }
  }, [selectedStatus]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) return <LoadingState title='Ladowanie listy backtestow' />;
  if (error) {
    return (
      <ErrorState
        title='Nie udalo sie pobrac listy backtestow'
        description={error}
        retryLabel='Sprobuj ponownie'
        onRetry={() => void loadData()}
      />
    );
  }
  if (rows.length === 0) {
    return <EmptyState title='Brak runow backtestu' description='Utworz pierwszy run, aby przejrzec wyniki.' />;
  }

  return (
    <BacktestsRunsTable
      rows={rows}
      selectedStatus={selectedStatus}
      onStatusChange={setSelectedStatus}
      onRefresh={() => void loadData()}
    />
  );
}
