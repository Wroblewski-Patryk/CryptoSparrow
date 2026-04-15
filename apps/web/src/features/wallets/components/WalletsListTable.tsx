'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { LuPencil, LuTrash2 } from 'react-icons/lu';
import { useI18n } from '@/i18n/I18nProvider';
import { deleteWallet } from '../services/wallets.service';
import { Wallet } from '../types/wallet.type';
import { dashboardRoutes } from '@/ui/layout/dashboard/dashboardRoutes';
import { getAxiosMessage } from '@/lib/getAxiosMessage';
import ConfirmModal from '@/ui/components/ConfirmModal';

type WalletsListTableProps = {
  rows: Wallet[];
  onDeleted: (id: string) => void;
};

export default function WalletsListTable({ rows, onDeleted }: WalletsListTableProps) {
  const { locale } = useI18n();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteWallet, setPendingDeleteWallet] = useState<Wallet | null>(null);

  const copy = useMemo(
    () =>
      locale === 'pl'
        ? {
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
            paperLabel: 'paper',
            livePercent: '{value}% salda',
            liveFixed: '{value} (fixed)',
          }
        : {
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
            paperLabel: 'paper',
            livePercent: '{value}% of balance',
            liveFixed: '{value} (fixed)',
          },
    [locale]
  );

  const formatAllocation = (wallet: Wallet) => {
    if (wallet.mode === 'PAPER') {
      return `${wallet.paperInitialBalance} ${wallet.baseCurrency} (${copy.paperLabel})`;
    }
    if (wallet.liveAllocationMode === 'PERCENT') {
      return copy.livePercent.replace('{value}', String(wallet.liveAllocationValue ?? 0));
    }
    return copy.liveFixed.replace('{value}', String(wallet.liveAllocationValue ?? 0));
  };

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

  return (
    <div className='overflow-x-auto rounded-box border border-base-300/60 bg-base-100/80'>
      <table className='table table-sm md:table-md'>
        <thead>
          <tr>
            <th>{copy.name}</th>
            <th>{copy.mode}</th>
            <th>{copy.exchange}</th>
            <th>{copy.marketType}</th>
            <th>{copy.baseCurrency}</th>
            <th>{copy.allocation}</th>
            <th className='text-right'>{copy.actions}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((wallet) => (
            <tr key={wallet.id}>
              <td className='font-medium'>{wallet.name}</td>
              <td>{wallet.mode}</td>
              <td>{wallet.exchange}</td>
              <td>{wallet.marketType}</td>
              <td>{wallet.baseCurrency}</td>
              <td>{formatAllocation(wallet)}</td>
              <td>
                <div className='flex items-center justify-end gap-2'>
                  <Link
                    href={dashboardRoutes.wallets.edit(wallet.id)}
                    className='btn btn-ghost btn-xs'
                  >
                    <LuPencil className='h-3.5 w-3.5' />
                    {copy.edit}
                  </Link>
                  <button
                    type='button'
                    className='btn btn-ghost btn-xs text-error'
                    disabled={deletingId === wallet.id}
                    onClick={() => setPendingDeleteWallet(wallet)}
                  >
                    <LuTrash2 className='h-3.5 w-3.5' />
                    {deletingId === wallet.id ? copy.deleting : copy.delete}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmModal
        open={Boolean(pendingDeleteWallet)}
        title={copy.delete}
        description={pendingDeleteWallet ? `"${pendingDeleteWallet.name}" - ${copy.deleteConfirm}` : copy.deleteConfirm}
        confirmLabel={copy.delete}
        cancelLabel={locale === 'pl' ? 'Anuluj' : 'Cancel'}
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
