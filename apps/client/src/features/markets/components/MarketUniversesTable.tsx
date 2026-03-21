'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { useLocaleFormatting } from '../../../i18n/useLocaleFormatting';
import DataTable, { DataTableColumn } from '../../../ui/components/DataTable';
import ConfirmModal from '../../../ui/components/ConfirmModal';
import { deleteMarketUniverse } from '../services/markets.service';
import { MarketUniverse } from '../types/marketUniverse.type';

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  const response = err.response?.data as { error?: { message?: string }; message?: string } | undefined;
  return response?.error?.message ?? response?.message;
};

type MarketUniversesTableProps = {
  rows: MarketUniverse[];
  onDeleted: (id: string) => void;
};

export default function MarketUniversesTable({ rows, onDeleted }: MarketUniversesTableProps) {
  const { formatDate } = useLocaleFormatting();
  const [deleteTarget, setDeleteTarget] = useState<MarketUniverse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const columns = useMemo<DataTableColumn<MarketUniverse>[]>(
    () => [
      { key: 'name', label: 'Nazwa', sortable: true, accessor: (row) => row.name },
      { key: 'marketType', label: 'Rynek', sortable: true, accessor: (row) => row.marketType },
      { key: 'baseCurrency', label: 'Base', sortable: true, accessor: (row) => row.baseCurrency },
      { key: 'whitelist', label: 'Whitelist', sortable: true, accessor: (row) => row.whitelist.length },
      { key: 'blacklist', label: 'Blacklist', sortable: true, accessor: (row) => row.blacklist.length },
      {
        key: 'createdAt',
        label: 'Utworzono',
        sortable: true,
        accessor: (row) => row.createdAt ?? '',
        render: (row) => (row.createdAt ? formatDate(row.createdAt) : '-'),
      },
      {
        key: 'actions',
        label: 'Akcje',
        render: (row) => (
          <div className='flex gap-2'>
            <Link href={`/dashboard/markets/${row.id}/edit`} className='btn btn-xs btn-outline'>
              Edytuj
            </Link>
            <button type='button' className='btn btn-xs btn-error' onClick={() => setDeleteTarget(row)}>
              Usun
            </button>
          </div>
        ),
      },
    ],
    [formatDate]
  );

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMarketUniverse(deleteTarget.id);
      onDeleted(deleteTarget.id);
      toast.success('Grupe rynkow usunieto');
      setDeleteTarget(null);
    } catch (error: unknown) {
      toast.error('Nie udalo sie usunac grupy rynkow', { description: getAxiosMessage(error) });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        title='Lista grup rynkow'
        description='Grupy rynkow do wykorzystania przez strategie, boty i backtesty.'
        filterPlaceholder='Filtruj grupy rynkow...'
        filterFn={(row, query) => {
          const normalized = query.trim().toUpperCase();
          return (
            row.name.toUpperCase().includes(normalized) ||
            row.baseCurrency.toUpperCase().includes(normalized) ||
            row.marketType.toUpperCase().includes(normalized)
          );
        }}
        emptyText='Brak grup rynkow.'
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title='Usunac grupe rynkow?'
        description={
          deleteTarget
            ? `Operacja usunie grupe "${deleteTarget.name}". Tego nie da sie cofnac.`
            : undefined
        }
        confirmLabel='Usun'
        cancelLabel='Anuluj'
        confirmVariant='error'
        pending={deleting}
        onCancel={() => {
          if (deleting) return;
          setDeleteTarget(null);
        }}
        onConfirm={() => void handleConfirmDelete()}
      />
    </>
  );
}
