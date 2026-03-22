'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { LuPencilLine } from 'react-icons/lu';
import DataTable, { DataTableColumn } from '@/ui/components/DataTable';
import { useLocaleFormatting } from '@/i18n/useLocaleFormatting';
import { BacktestRun, BacktestStatus } from '../types/backtest.type';

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

export default function BacktestsRunsTable({ rows, selectedStatus, onStatusChange, onRefresh }: BacktestsRunsTableProps) {
  const { formatDateTime } = useLocaleFormatting();

  const columns = useMemo<DataTableColumn<BacktestRun>[]>(
    () => [
      {
        key: 'name',
        label: 'Nazwa',
        sortable: true,
        accessor: (row) => row.name,
        className: 'font-medium',
      },
      {
        key: 'symbol',
        label: 'Symbol',
        sortable: true,
        accessor: (row) => row.symbol,
      },
      {
        key: 'timeframe',
        label: 'Interwal',
        sortable: true,
        accessor: (row) => row.timeframe,
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        accessor: (row) => row.status,
        render: (row) => <span className={statusBadgeClass(row.status)}>{row.status}</span>,
      },
      {
        key: 'startedAt',
        label: 'Start',
        sortable: true,
        accessor: (row) => row.startedAt,
        render: (row) => formatDateTime(row.startedAt),
      },
      {
        key: 'actions',
        label: 'Akcje',
        className: 'w-32 text-center',
        render: (row) => (
          <div className='flex items-center justify-center gap-2'>
            <Link
              href={`/dashboard/backtests/${row.id}`}
              className='btn btn-sm btn-info'
              title='Podglad'
              aria-label={`Podglad ${row.name}`}
            >
              <LuPencilLine className='h-4 w-4' />
            </Link>
          </div>
        ),
      },
    ],
    [formatDateTime]
  );

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-end gap-3'>
        <label className='form-control w-full sm:w-56'>
          <span className='label-text'>Filtr statusu</span>
          <select
            className='select select-bordered select-sm'
            value={selectedStatus}
            onChange={(event) => onStatusChange(event.target.value as BacktestStatus | 'ALL')}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <button type='button' className='btn btn-sm btn-outline' onClick={onRefresh}>
          Odswiez
        </button>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        title='Lista backtestow'
        description='Uruchomione i zakonczone runy backtestowe.'
        filterPlaceholder='Filtruj runy...'
        filterFn={(row, query) => {
          const normalized = query.trim().toUpperCase();
          return (
            row.name.toUpperCase().includes(normalized) ||
            row.symbol.toUpperCase().includes(normalized) ||
            row.timeframe.toUpperCase().includes(normalized) ||
            row.status.toUpperCase().includes(normalized)
          );
        }}
        emptyText='Brak runow backtestu.'
      />
    </div>
  );
}

