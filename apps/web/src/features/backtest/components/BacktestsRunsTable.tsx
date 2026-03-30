'use client';

import { useContext, useMemo } from 'react';
import Link from 'next/link';
import { LuPencilLine } from 'react-icons/lu';
import DataTable, { DataTableColumn } from '@/ui/components/DataTable';
import { useLocaleFormatting } from '@/i18n/useLocaleFormatting';
import { BacktestRun, BacktestStatus } from '../types/backtest.type';
import { I18nContext } from '../../../i18n/I18nProvider';

type BacktestsRunsTableProps = {
  rows: BacktestRun[];
  selectedStatus: BacktestStatus | 'ALL';
  onStatusChange: (next: BacktestStatus | 'ALL') => void;
  onRefresh: () => void;
};

const statuses: Array<BacktestStatus | 'ALL'> = ['ALL', 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED'];

const statusBadgeClass = (status: BacktestStatus) => {
  if (status === 'COMPLETED') return 'badge badge-success badge-outline';
  if (status === 'FAILED' || status === 'CANCELED') return 'badge badge-error badge-outline';
  if (status === 'RUNNING') return 'badge badge-info badge-outline';
  return 'badge badge-warning badge-outline';
};

const getStatusLabel = (status: BacktestStatus | 'ALL', locale: 'pl' | 'en') => {
  if (status === 'ALL') return locale === 'en' ? 'All' : 'Wszystkie';
  if (status === 'PENDING') return locale === 'en' ? 'Pending' : 'Oczekuje';
  if (status === 'RUNNING') return locale === 'en' ? 'Running' : 'W toku';
  if (status === 'COMPLETED') return locale === 'en' ? 'Completed' : 'Zakonczony';
  if (status === 'FAILED') return locale === 'en' ? 'Failed' : 'Niepowodzenie';
  return locale === 'en' ? 'Canceled' : 'Anulowany';
};

export default function BacktestsRunsTable({ rows, selectedStatus, onStatusChange, onRefresh }: BacktestsRunsTableProps) {
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
          previewAriaPrefix: 'Preview',
          statusFilter: 'Status filter',
          refresh: 'Refresh',
          tableTitle: 'Backtest runs',
          tableDescription: 'Running and completed backtest runs.',
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
          previewAriaPrefix: 'Podglad',
          statusFilter: 'Filtr statusu',
          refresh: 'Odswiez',
          tableTitle: 'Lista backtestow',
          tableDescription: 'Uruchomione i zakonczone runy backtestowe.',
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
        render: (row) => <span className={statusBadgeClass(row.status)}>{getStatusLabel(row.status, locale)}</span>,
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
        className: 'w-32 text-center',
        render: (row) => (
          <div className='flex items-center justify-center gap-2'>
            <Link
              href={`/dashboard/backtests/${row.id}`}
              className='btn btn-sm btn-info'
              title={copy.preview}
              aria-label={`${copy.previewAriaPrefix} ${row.name}`}
            >
              <LuPencilLine className='h-4 w-4' />
            </Link>
          </div>
        ),
      },
    ],
    [copy.colActions, copy.colName, copy.colStart, copy.colStatus, copy.colSymbol, copy.colTimeframe, copy.preview, copy.previewAriaPrefix, formatDateTime, locale]
  );

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-end gap-3'>
        <label className='form-control w-full sm:w-56'>
          <span className='label-text'>{copy.statusFilter}</span>
          <select
            className='select select-bordered select-sm'
            value={selectedStatus}
            onChange={(event) => onStatusChange(event.target.value as BacktestStatus | 'ALL')}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {getStatusLabel(status, locale)}
              </option>
            ))}
          </select>
        </label>

        <button type='button' className='btn btn-sm btn-outline' onClick={onRefresh}>
          {copy.refresh}
        </button>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        title={copy.tableTitle}
        description={copy.tableDescription}
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

