'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';
import { useI18n } from '@/i18n/I18nProvider';
import { createWallet, deleteWallet } from '../services/wallets.service';
import { Wallet } from '../types/wallet.type';
import { dashboardRoutes } from '@/ui/layout/dashboard/dashboardRoutes';
import { getAxiosMessage } from '@/lib/getAxiosMessage';
import ConfirmModal from '@/ui/components/ConfirmModal';
import DataTable, { DataTableColumn } from '@/ui/components/DataTable';
import { TablePresetButtonAction, TablePresetLinkAction, TableToneBadge } from '@/ui/components/TableUi';
import { buildNextCloneName } from '@/lib/cloneNaming';

type WalletsListTableProps = {
  rows: Wallet[];
  onDeleted: (id: string) => void;
  onCloned?: (wallet: Wallet) => void;
};

export default function WalletsListTable({ rows, onDeleted, onCloned }: WalletsListTableProps) {
  const { locale } = useI18n();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [pendingDeleteWallet, setPendingDeleteWallet] = useState<Wallet | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const copy = useMemo(
    () =>
      ({
        en: {
          name: 'Name',
          mode: 'Mode',
          exchange: 'Exchange',
          marketType: 'Market',
          baseCurrency: 'Base currency',
          allocation: 'Allocation',
          actions: 'Actions',
          edit: 'Edit',
          delete: 'Delete',
          deleting: 'Deleting...',
          deleteConfirm: 'Delete this wallet?',
          deleted: 'Wallet deleted',
          deleteFailed: 'Failed to delete wallet',
          clone: 'Clone',
          cloned: 'Wallet cloned',
          cloneFailed: 'Failed to clone wallet',
          paperLabel: 'paper',
          livePercent: '{value}% of balance',
          liveFixed: '{value} (fixed)',
          searchPlaceholder: 'Filter wallets...',
          emptyText: 'No wallets.',
          details: 'Details',
          hideDetails: 'Hide details',
          allocationMode: 'Allocation mode',
          apiKey: 'API key',
          apiKeyConnected: 'Connected',
          apiKeyMissing: 'Not connected',
          columns: 'Columns',
          cancel: 'Cancel',
        },
        pl: {
          name: 'Nazwa',
          mode: 'Tryb',
          exchange: 'Gielda',
          marketType: 'Rynek',
          baseCurrency: 'Waluta bazowa',
          allocation: 'Budzet',
          actions: 'Akcje',
          edit: 'Edytuj',
          delete: 'Usun',
          deleting: 'Usuwanie...',
          deleteConfirm: 'Usunac ten portfel?',
          deleted: 'Portfel usuniety',
          deleteFailed: 'Nie udalo sie usunac portfela',
          clone: 'Klonuj',
          cloned: 'Portfel sklonowany',
          cloneFailed: 'Nie udalo sie sklonowac portfela',
          paperLabel: 'paper',
          livePercent: '{value}% salda',
          liveFixed: '{value} (fixed)',
          searchPlaceholder: 'Filtruj portfele...',
          emptyText: 'Brak portfeli.',
          details: 'Szczegoly',
          hideDetails: 'Ukryj szczegoly',
          allocationMode: 'Tryb alokacji',
          apiKey: 'Klucz API',
          apiKeyConnected: 'Podlaczony',
          apiKeyMissing: 'Brak',
          columns: 'Kolumny',
          cancel: 'Anuluj',
        },
        pt: {
          name: 'Nome',
          mode: 'Modo',
          exchange: 'Corretora',
          marketType: 'Mercado',
          baseCurrency: 'Moeda base',
          allocation: 'Alocacao',
          actions: 'Acoes',
          edit: 'Editar',
          delete: 'Remover',
          deleting: 'A remover...',
          deleteConfirm: 'Remover esta carteira?',
          deleted: 'Carteira removida',
          deleteFailed: 'Falha ao remover carteira',
          clone: 'Clonar',
          cloned: 'Carteira clonada',
          cloneFailed: 'Falha ao clonar carteira',
          paperLabel: 'paper',
          livePercent: '{value}% do saldo',
          liveFixed: '{value} (fixo)',
          searchPlaceholder: 'Filtrar carteiras...',
          emptyText: 'Sem carteiras.',
          details: 'Detalhes',
          hideDetails: 'Ocultar detalhes',
          allocationMode: 'Modo de alocacao',
          apiKey: 'Chave API',
          apiKeyConnected: 'Ligada',
          apiKeyMissing: 'Nao ligada',
          columns: 'Colunas',
          cancel: 'Cancelar',
        },
      } as const)[locale],
    [locale]
  );

  const formatAllocation = useCallback(
    (wallet: Wallet) => {
      if (wallet.mode === 'PAPER') {
        return `${wallet.paperInitialBalance} ${wallet.baseCurrency} (${copy.paperLabel})`;
      }
      if (wallet.liveAllocationMode === 'PERCENT') {
        return copy.livePercent.replace('{value}', String(wallet.liveAllocationValue ?? 0));
      }
      return copy.liveFixed.replace('{value}', String(wallet.liveAllocationValue ?? 0));
    },
    [copy.liveFixed, copy.livePercent, copy.paperLabel]
  );

  const handleDelete = async () => {
    if (!pendingDeleteWallet) return;
    setDeletingId(pendingDeleteWallet.id);
    try {
      await deleteWallet(pendingDeleteWallet.id);
      onDeleted(pendingDeleteWallet.id);
      toast.success(copy.deleted);
    } catch (err) {
      toast.error(copy.deleteFailed, { description: getAxiosMessage(err) });
    } finally {
      setDeletingId(null);
      setPendingDeleteWallet(null);
    }
  };

  const handleClone = async (wallet: Wallet) => {
    setCloningId(wallet.id);
    try {
      const clonedWallet = await createWallet({
        name: buildNextCloneName(wallet.name, rows.map((item) => item.name)),
        mode: wallet.mode,
        exchange: wallet.exchange,
        marketType: wallet.marketType,
        baseCurrency: wallet.baseCurrency,
        paperInitialBalance: wallet.paperInitialBalance,
        liveAllocationMode: wallet.liveAllocationMode ?? null,
        liveAllocationValue: wallet.liveAllocationValue ?? null,
        apiKeyId: wallet.apiKeyId ?? null,
      });
      onCloned?.(clonedWallet);
      toast.success(copy.cloned);
    } catch (err) {
      toast.error(copy.cloneFailed, { description: getAxiosMessage(err) });
    } finally {
      setCloningId(null);
    }
  };

  const columns = useMemo<DataTableColumn<Wallet>[]>(
    () => [
      {
        key: 'name',
        label: copy.name,
        sortable: true,
        accessor: (row) => row.name,
        className: 'font-medium',
      },
      {
        key: 'mode',
        label: copy.mode,
        sortable: true,
        accessor: (row) => row.mode,
        render: (row) => (
          <TableToneBadge label={row.mode} tone={row.mode === 'LIVE' ? 'warning' : 'info'} />
        ),
      },
      {
        key: 'exchange',
        label: copy.exchange,
        sortable: true,
        accessor: (row) => row.exchange,
      },
      {
        key: 'marketType',
        label: copy.marketType,
        sortable: true,
        accessor: (row) => row.marketType,
      },
      {
        key: 'baseCurrency',
        label: copy.baseCurrency,
        sortable: true,
        accessor: (row) => row.baseCurrency,
      },
      {
        key: 'allocation',
        label: copy.allocation,
        sortable: true,
        accessor: (row) => formatAllocation(row),
      },
      {
        key: 'actions',
        label: copy.actions,
        className: 'w-56 text-right',
        render: (row) => (
          <div className='flex items-center justify-end gap-2'>
            <TablePresetButtonAction
              preset='details'
              label={expandedRows[row.id] ? copy.hideDetails : copy.details}
              icon={
                expandedRows[row.id] ? (
                  <LuChevronUp className='h-3.5 w-3.5' />
                ) : (
                  <LuChevronDown className='h-3.5 w-3.5' />
                )
              }
              onClick={() =>
                setExpandedRows((prev) => ({
                  ...prev,
                  [row.id]: !prev[row.id],
                }))
              }
            />
            <TablePresetLinkAction
              preset='edit'
              href={dashboardRoutes.wallets.edit(row.id)}
              label={copy.edit}
            />
            <TablePresetButtonAction
              preset='clone'
              label={copy.clone}
              onClick={() => void handleClone(row)}
              disabled={cloningId === row.id}
            />
            <TablePresetButtonAction
              preset='delete'
              label={deletingId === row.id ? copy.deleting : copy.delete}
              onClick={() => setPendingDeleteWallet(row)}
              disabled={deletingId === row.id}
            />
          </div>
        ),
      },
    ],
    [
      copy.actions,
      copy.allocation,
      copy.baseCurrency,
      copy.delete,
      copy.deleting,
      copy.details,
      copy.edit,
      copy.exchange,
      copy.hideDetails,
      copy.clone,
      copy.marketType,
      copy.mode,
      copy.name,
      cloningId,
      deletingId,
      expandedRows,
      formatAllocation,
      handleClone,
    ]
  );

  return (
    <div className='space-y-3'>
      <DataTable
        compact
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        filterPlaceholder={copy.searchPlaceholder}
        filterFn={(row, query) => {
          const normalized = query.trim().toLowerCase();
          return (
            row.name.toLowerCase().includes(normalized) ||
            row.mode.toLowerCase().includes(normalized) ||
            row.exchange.toLowerCase().includes(normalized) ||
            row.marketType.toLowerCase().includes(normalized) ||
            row.baseCurrency.toLowerCase().includes(normalized)
          );
        }}
        emptyText={copy.emptyText}
        advancedMode
        columnsToggleLabel={copy.columns}
        columnVisibilityPreferenceKey='wallets.list'
        isRowExpanded={(row) => Boolean(expandedRows[row.id])}
        renderExpandedRow={(row) => (
          <div className='rounded-box border border-base-300 bg-base-200/60 p-3'>
            <div className='grid gap-2 text-xs md:grid-cols-3'>
              <p>
                <span className='opacity-70'>{copy.mode}: </span>
                <span className='font-medium'>{row.mode}</span>
              </p>
              <p>
                <span className='opacity-70'>{copy.marketType}: </span>
                <span className='font-medium'>{row.marketType}</span>
              </p>
              <p>
                <span className='opacity-70'>{copy.allocationMode}: </span>
                <span className='font-medium'>{row.liveAllocationMode ?? copy.paperLabel}</span>
              </p>
              <p>
                <span className='opacity-70'>{copy.allocation}: </span>
                <span className='font-medium'>{formatAllocation(row)}</span>
              </p>
              <p>
                <span className='opacity-70'>{copy.baseCurrency}: </span>
                <span className='font-medium'>{row.baseCurrency}</span>
              </p>
              <p>
                <span className='opacity-70'>{copy.apiKey}: </span>
                <span className='font-medium'>
                  {row.apiKeyId ? copy.apiKeyConnected : copy.apiKeyMissing}
                </span>
              </p>
            </div>
          </div>
        )}
      />

      <ConfirmModal
        open={Boolean(pendingDeleteWallet)}
        title={copy.delete}
        description={pendingDeleteWallet ? `"${pendingDeleteWallet.name}" - ${copy.deleteConfirm}` : copy.deleteConfirm}
        confirmLabel={copy.delete}
        cancelLabel={copy.cancel}
        confirmVariant='error'
        pending={Boolean(deletingId)}
        onCancel={() => {
          if (deletingId) return;
          setPendingDeleteWallet(null);
        }}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
