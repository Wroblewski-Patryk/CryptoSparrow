'use client';

import { useContext, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { LuPencilLine, LuTrash2 } from 'react-icons/lu';
import DataTable, { DataTableColumn } from '@/ui/components/DataTable';
import ConfirmModal from '@/ui/components/ConfirmModal';
import { TableIconButtonAction, TableIconLinkAction, TableToneBadge } from '@/ui/components/TableUi';
import { useLocaleFormatting } from '@/i18n/useLocaleFormatting';
import { BacktestRun, BacktestStatus } from '../types/backtest.type';
import { I18nContext } from '../../../i18n/I18nProvider';
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

const getStatusLabel = (status: BacktestStatus, locale: 'en' | 'pl' | 'pt') => {
  if (status === 'PENDING') return locale === 'en' ? 'Pending' : locale === 'pt' ? 'Pendente' : 'Oczekuje';
  if (status === 'RUNNING') return locale === 'en' ? 'Running' : locale === 'pt' ? 'Em execucao' : 'W toku';
  if (status === 'COMPLETED') return locale === 'en' ? 'Completed' : locale === 'pt' ? 'Concluido' : 'Zakonczony';
  if (status === 'FAILED') return locale === 'en' ? 'Failed' : locale === 'pt' ? 'Falhou' : 'Niepowodzenie';
  return locale === 'en' ? 'Canceled' : locale === 'pt' ? 'Cancelado' : 'Anulowany';
};

export default function BacktestsRunsTable({ rows, onDeleted }: BacktestsRunsTableProps) {
  const { formatDateTime } = useLocaleFormatting();
  const i18n = useContext(I18nContext);
  const locale = i18n?.locale ?? 'pl';
  const [selectedDeleteRun, setSelectedDeleteRun] = useState<BacktestRun | null>(null);
  const [deleting, setDeleting] = useState(false);
  const copy = {
    en: {
      colName: 'Name',
      colSymbol: 'Symbol',
      colTimeframe: 'Interval',
      colStatus: 'Status',
      colStart: 'Start',
      colActions: 'Actions',
      preview: 'Preview',
      delete: 'Delete',
      deleted: 'Backtest run deleted',
      deleteFailed: 'Could not delete backtest run',
      deleteTitle: 'Delete backtest run?',
      cancel: 'Cancel',
      filterPlaceholder: 'Filter runs...',
      emptyText: 'No backtest runs.',
    },
    pl: {
      colName: 'Nazwa',
      colSymbol: 'Symbol',
      colTimeframe: 'Interwal',
      colStatus: 'Status',
      colStart: 'Start',
      colActions: 'Akcje',
      preview: 'Podglad',
      delete: 'Usun',
      deleted: 'Run backtestu usuniety',
      deleteFailed: 'Nie udalo sie usunac runa backtestu',
      deleteTitle: 'Usunac run backtestu?',
      cancel: 'Anuluj',
      filterPlaceholder: 'Filtruj runy...',
      emptyText: 'Brak runow backtestu.',
    },
    pt: {
      colName: 'Nome',
      colSymbol: 'Simbolo',
      colTimeframe: 'Intervalo',
      colStatus: 'Estado',
      colStart: 'Inicio',
      colActions: 'Acoes',
      preview: 'Prever',
      delete: 'Remover',
      deleted: 'Execucao de backtest removida',
      deleteFailed: 'Nao foi possivel remover execucao de backtest',
      deleteTitle: 'Remover execucao de backtest?',
      cancel: 'Cancelar',
      filterPlaceholder: 'Filtrar execucoes...',
      emptyText: 'Sem execucoes de backtest.',
    },
  }[locale];

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
    [copy.colActions, copy.colName, copy.colStart, copy.colStatus, copy.colSymbol, copy.colTimeframe, copy.delete, copy.preview, formatDateTime, locale]
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

