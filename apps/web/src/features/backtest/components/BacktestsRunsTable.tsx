'use client';

import { useContext, useMemo } from 'react';
import { LuPencilLine } from 'react-icons/lu';
import DataTable, { DataTableColumn } from '@/ui/components/DataTable';
import { TableIconLinkAction, TableToneBadge } from '@/ui/components/TableUi';
import { useLocaleFormatting } from '@/i18n/useLocaleFormatting';
import { BacktestRun, BacktestStatus } from '../types/backtest.type';
import { I18nContext } from '../../../i18n/I18nProvider';

type BacktestsRunsTableProps = {
  rows: BacktestRun[];
};

const statusBadgeTone = (status: BacktestStatus): 'success' | 'danger' | 'info' | 'warning' => {
  if (status === 'COMPLETED') return 'success';
  if (status === 'FAILED' || status === 'CANCELED') return 'danger';
  if (status === 'RUNNING') return 'info';
  return 'warning';
};

const getStatusLabel = (status: BacktestStatus, locale: 'pl' | 'en') => {
  if (status === 'PENDING') return locale === 'en' ? 'Pending' : 'Oczekuje';
  if (status === 'RUNNING') return locale === 'en' ? 'Running' : 'W toku';
  if (status === 'COMPLETED') return locale === 'en' ? 'Completed' : 'Zakonczony';
  if (status === 'FAILED') return locale === 'en' ? 'Failed' : 'Niepowodzenie';
  return locale === 'en' ? 'Canceled' : 'Anulowany';
};

export default function BacktestsRunsTable({ rows }: BacktestsRunsTableProps) {
  const { formatDateTime } = useLocaleFormatting();
  const i18n = useContext(I18nContext);
  const locale = i18n?.locale === 'en' ? 'en' : 'pl';
  const copy =
    locale === 'en'
      ? {
          colName: 'Name',
          colSymbol: 'Symbol',
          colTimeframe: 'Interval',
          colStatus: 'Status',
          colStart: 'Start',
          colActions: 'Actions',
          preview: 'Preview',
          filterPlaceholder: 'Filter runs...',
          emptyText: 'No backtest runs.',
        }
      : {
          colName: 'Nazwa',
          colSymbol: 'Symbol',
          colTimeframe: 'Interwal',
          colStatus: 'Status',
          colStart: 'Start',
          colActions: 'Akcje',
          preview: 'Podglad',
          filterPlaceholder: 'Filtruj runy...',
          emptyText: 'Brak runow backtestu.',
        };

  const columns = useMemo<DataTableColumn<BacktestRun>[]>(
    () => [
      {
        key: 'name',
        label: copy.colName,
        sortable: true,
        accessor: (row) => row.name,
        className: 'font-medium',
      },
      {
        key: 'symbol',
        label: copy.colSymbol,
        sortable: true,
        accessor: (row) => row.symbol,
      },
      {
        key: 'timeframe',
        label: copy.colTimeframe,
        sortable: true,
        accessor: (row) => row.timeframe,
      },
      {
        key: 'status',
        label: copy.colStatus,
        sortable: true,
        accessor: (row) => row.status,
        render: (row) => (
          <TableToneBadge label={getStatusLabel(row.status, locale)} tone={statusBadgeTone(row.status)} />
        ),
      },
      {
        key: 'startedAt',
        label: copy.colStart,
        sortable: true,
        accessor: (row) => row.startedAt,
        render: (row) => formatDateTime(row.startedAt),
      },
      {
        key: 'actions',
        label: copy.colActions,
        className: 'w-24 text-center',
        render: (row) => (
          <div className='flex items-center justify-center gap-2'>
            <TableIconLinkAction
              href={`/dashboard/backtests/${row.id}`}
              label={`${copy.preview} ${row.name}`}
              icon={<LuPencilLine className='h-3.5 w-3.5' />}
            />
          </div>
        ),
      },
    ],
    [copy.colActions, copy.colName, copy.colStart, copy.colStatus, copy.colSymbol, copy.colTimeframe, copy.preview, formatDateTime, locale]
  );

  return (
    <div className='space-y-3'>
      <DataTable
        compact
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        filterPlaceholder={copy.filterPlaceholder}
        filterFn={(row, query) => {
          const normalized = query.trim().toUpperCase();
          return (
            row.name.toUpperCase().includes(normalized) ||
            row.symbol.toUpperCase().includes(normalized) ||
            row.timeframe.toUpperCase().includes(normalized) ||
            row.status.toUpperCase().includes(normalized)
          );
        }}
        emptyText={copy.emptyText}
      />
    </div>
  );
}

