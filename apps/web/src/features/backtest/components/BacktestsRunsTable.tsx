'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { LuPencilLine, LuTrash2 } from 'react-icons/lu';
import DataTable, { DataTableColumn } from '@/ui/components/DataTable';
import ConfirmModal from '@/ui/components/ConfirmModal';
import { TableIconButtonAction, TableIconLinkAction, TableToneBadge } from '@/ui/components/TableUi';
import { useLocaleFormatting } from '@/i18n/useLocaleFormatting';
import { BacktestRun, BacktestStatus } from '../types/backtest.type';
import { useI18n } from '../../../i18n/I18nProvider';
import { deleteBacktestRun } from '../services/backtests.service';
import { getAxiosMessage } from '@/lib/getAxiosMessage';
import { normalizeUppercaseToken } from '@/lib/text';

type BacktestsRunsTableProps = {
  rows: BacktestRun[];
  onDeleted?: (id: string) => void;
};

const statusBadgeTone = (status: BacktestStatus): 'success' | 'danger' | 'info' | 'warning' => {
  if (status === 'COMPLETED') return 'success';
  if (status === 'FAILED' || status === 'CANCELED') return 'danger';
  if (status === 'RUNNING') return 'info';
  return 'warning';
};

export default function BacktestsRunsTable({ rows, onDeleted }: BacktestsRunsTableProps) {
  const { formatDateTime } = useLocaleFormatting();
  const { t } = useI18n();
  const [selectedDeleteRun, setSelectedDeleteRun] = useState<BacktestRun | null>(null);
  const [deleting, setDeleting] = useState(false);
  const copy = useMemo(
    () => ({
      colName: t('dashboard.backtests.runsTable.colName'),
      colSymbol: t('dashboard.backtests.runsTable.colSymbol'),
      colTimeframe: t('dashboard.backtests.runsTable.colTimeframe'),
      colStatus: t('dashboard.backtests.runsTable.colStatus'),
      colStart: t('dashboard.backtests.runsTable.colStart'),
      colActions: t('dashboard.backtests.runsTable.colActions'),
      preview: t('dashboard.backtests.runsTable.preview'),
      delete: t('dashboard.backtests.runsTable.delete'),
      deleted: t('dashboard.backtests.runsTable.deleted'),
      deleteFailed: t('dashboard.backtests.runsTable.deleteFailed'),
      deleteTitle: t('dashboard.backtests.runsTable.deleteTitle'),
      cancel: t('dashboard.backtests.runsTable.cancel'),
      filterPlaceholder: t('dashboard.backtests.runsTable.filterPlaceholder'),
      emptyText: t('dashboard.backtests.runsTable.emptyText'),
      statusPending: t('dashboard.backtests.runsTable.statusPending'),
      statusRunning: t('dashboard.backtests.runsTable.statusRunning'),
      statusCompleted: t('dashboard.backtests.runsTable.statusCompleted'),
      statusFailed: t('dashboard.backtests.runsTable.statusFailed'),
      statusCanceled: t('dashboard.backtests.runsTable.statusCanceled'),
    }),
    [t]
  );
  const getStatusLabel = (status: BacktestStatus) => {
    if (status === 'PENDING') return copy.statusPending;
    if (status === 'RUNNING') return copy.statusRunning;
    if (status === 'COMPLETED') return copy.statusCompleted;
    if (status === 'FAILED') return copy.statusFailed;
    return copy.statusCanceled;
  };

  const handleDelete = async () => {
    if (!selectedDeleteRun) return;
    setDeleting(true);
    try {
      await deleteBacktestRun(selectedDeleteRun.id);
      onDeleted?.(selectedDeleteRun.id);
      toast.success(copy.deleted);
      setSelectedDeleteRun(null);
    } catch (error: unknown) {
      toast.error(copy.deleteFailed, {
        description: getAxiosMessage(error),
      });
    } finally {
      setDeleting(false);
    }
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
        render: (row) => <TableToneBadge label={getStatusLabel(row.status)} tone={statusBadgeTone(row.status)} />,
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
        className: 'w-28 text-center',
        render: (row) => (
          <div className='flex items-center justify-center gap-2'>
            <TableIconLinkAction
              href={`/dashboard/backtests/${row.id}`}
              label={`${copy.preview} ${row.name}`}
              icon={<LuPencilLine className='h-3.5 w-3.5' />}
            />
            <TableIconButtonAction
              label={copy.delete}
              icon={<LuTrash2 className='h-3.5 w-3.5' />}
              onClick={() => setSelectedDeleteRun(row)}
              tone='danger'
            />
          </div>
        ),
      },
    ],
    [
      copy.colActions,
      copy.colName,
      copy.colStart,
      copy.colStatus,
      copy.colSymbol,
      copy.colTimeframe,
      copy.delete,
      copy.preview,
      copy.statusCanceled,
      copy.statusCompleted,
      copy.statusFailed,
      copy.statusPending,
      copy.statusRunning,
      formatDateTime,
    ]
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
          const normalized = normalizeUppercaseToken(query);
          return (
            normalizeUppercaseToken(row.name).includes(normalized) ||
            normalizeUppercaseToken(row.symbol).includes(normalized) ||
            normalizeUppercaseToken(row.timeframe).includes(normalized) ||
            normalizeUppercaseToken(row.status).includes(normalized)
          );
        }}
        emptyText={copy.emptyText}
        advancedMode
        columnVisibilityPreferenceKey='backtests.runs.list'
      />

      <ConfirmModal
        open={Boolean(selectedDeleteRun)}
        title={copy.deleteTitle}
        description={
          selectedDeleteRun
            ? `${copy.delete} "${selectedDeleteRun.name}"?`
            : copy.delete
        }
        confirmLabel={copy.delete}
        cancelLabel={copy.cancel}
        confirmVariant='error'
        pending={deleting}
        onCancel={() => {
          if (deleting) return;
          setSelectedDeleteRun(null);
        }}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

