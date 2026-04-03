'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import axios from 'axios';
import { LuPencilLine, LuTrash2 } from 'react-icons/lu';
import { useLocaleFormatting } from '../../../i18n/useLocaleFormatting';
import DataTable, { DataTableColumn } from '../../../ui/components/DataTable';
import ConfirmModal from '../../../ui/components/ConfirmModal';
import { TableIconButtonAction, TableToneBadge } from '../../../ui/components/TableUi';
import { deleteMarketUniverse, fetchMarketCatalog } from '../services/markets.service';
import { MarketUniverse } from '../types/marketUniverse.type';

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  const response = err.response?.data as { error?: { message?: string }; message?: string } | undefined;
  return response?.error?.message ?? response?.message;
};

const MARKET_UNIVERSE_ACTIVE_BOT_DELETE_ERROR =
  'market universe is used by active bot and cannot be deleted';

type MarketUniversesTableProps = {
  rows: MarketUniverse[];
  onDeleted: (id: string) => void;
};

const uniqueSorted = (values: string[]) =>
  [...new Set(values.map((item) => item.trim().toUpperCase()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

type ResolvedTickers = {
  tickers: string[];
  loading: boolean;
};

const resolveMinVolumeRules = (row: MarketUniverse) => {
  const rules = (row.filterRules ?? null) as
    | { minQuoteVolumeEnabled?: boolean; minQuoteVolume24h?: number; minVolume24h?: number }
    | null;

  const enabled =
    typeof rules?.minQuoteVolumeEnabled === 'boolean'
      ? rules.minQuoteVolumeEnabled
      : typeof rules?.minQuoteVolume24h === 'number' || typeof rules?.minVolume24h === 'number';
  const min = typeof rules?.minQuoteVolume24h === 'number'
    ? rules.minQuoteVolume24h
    : (typeof rules?.minVolume24h === 'number' ? rules.minVolume24h : 0);

  return { enabled, min };
};

export default function MarketUniversesTable({ rows, onDeleted }: MarketUniversesTableProps) {
  const router = useRouter();
  const { formatDate } = useLocaleFormatting();
  const [deleteTarget, setDeleteTarget] = useState<MarketUniverse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [resolvedTickersMap, setResolvedTickersMap] = useState<Record<string, ResolvedTickers>>({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (rows.length === 0) {
        setResolvedTickersMap({});
        return;
      }

      setResolvedTickersMap((prev) => {
        const next = { ...prev };
        for (const row of rows) {
          next[row.id] = { tickers: next[row.id]?.tickers ?? [], loading: true };
        }
        return next;
      });

      const catalogByKey = new Map<string, Awaited<ReturnType<typeof fetchMarketCatalog>>>();
      for (const row of rows) {
        const key = `${row.exchange ?? 'BINANCE'}|${row.marketType}|${row.baseCurrency}`;
        if (!catalogByKey.has(key)) {
          const catalog = await fetchMarketCatalog({
            exchange: row.exchange ?? 'BINANCE',
            marketType: row.marketType,
            baseCurrency: row.baseCurrency,
          });
          catalogByKey.set(key, catalog);
        }
      }

      if (!active) return;

      const nextMap: Record<string, ResolvedTickers> = {};
      for (const row of rows) {
        const key = `${row.exchange ?? 'BINANCE'}|${row.marketType}|${row.baseCurrency}`;
        const catalog = catalogByKey.get(key);
        const rules = resolveMinVolumeRules(row);
        const filteredByVolume = (catalog?.markets ?? []).filter((market) =>
          rules.enabled ? (market.quoteVolume24h ?? 0) >= rules.min : true
        );
        const availableSymbols = filteredByVolume.map((item) => item.symbol);
        const availableSet = new Set(availableSymbols);
        const include = row.whitelist.length > 0
          ? row.whitelist.filter((symbol) => availableSet.has(symbol))
          : availableSymbols;
        const blacklistSet = new Set(row.blacklist);
        const tickers = uniqueSorted(include).filter((symbol) => !blacklistSet.has(symbol));

        nextMap[row.id] = { tickers, loading: false };
      }

      setResolvedTickersMap(nextMap);
    };

    void load().catch(() => {
      if (!active) return;
      setResolvedTickersMap((prev) => {
        const next = { ...prev };
        for (const row of rows) {
          next[row.id] = { tickers: next[row.id]?.tickers ?? [], loading: false };
        }
        return next;
      });
    });

    return () => {
      active = false;
    };
  }, [rows]);

  const columns = useMemo<DataTableColumn<MarketUniverse>[]>(
    () => [
      { key: 'name', label: 'Nazwa', sortable: true, accessor: (row) => row.name },
      { key: 'exchange', label: 'Gielda', sortable: true, accessor: (row) => row.exchange ?? 'BINANCE' },
      { key: 'marketType', label: 'Rynek', sortable: true, accessor: (row) => row.marketType },
      { key: 'baseCurrency', label: 'Base', sortable: true, accessor: (row) => row.baseCurrency },
      { key: 'whitelist', label: 'Whitelist', sortable: true, accessor: (row) => row.whitelist.length },
      { key: 'blacklist', label: 'Blacklist', sortable: true, accessor: (row) => row.blacklist.length },
      {
        key: 'resolvedTickers',
        label: 'Tickery po filtrach',
        sortable: true,
        accessor: (row) => resolvedTickersMap[row.id]?.tickers.length ?? 0,
        render: (row) => {
          const resolved = resolvedTickersMap[row.id];
          const count = resolved?.tickers.length ?? 0;
          const expanded = Boolean(expandedRows[row.id]);

          return (
            <div className='flex items-center gap-2'>
              <TableToneBadge label={resolved?.loading ? '...' : `${count}`} tone='neutral' className='font-mono' />
              {!resolved?.loading && count > 0 ? (
                <button
                  type='button'
                  className='btn btn-xs btn-ghost'
                  onClick={() =>
                    setExpandedRows((prev) => ({ ...prev, [row.id]: !prev[row.id] }))
                  }
                >
                  {expanded ? 'Ukryj' : 'Pokaz wszystkie'}
                </button>
              ) : null}
            </div>
          );
        },
      },
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
        className: 'w-28 text-center',
        render: (row) => (
          <div className='flex items-center justify-center gap-2'>
            <TableIconButtonAction
              label='Edytuj'
              icon={<LuPencilLine className='h-3.5 w-3.5' />}
              onClick={() => router.push(`/dashboard/markets/${row.id}/edit`)}
            />
            <TableIconButtonAction
              label='Usun'
              icon={<LuTrash2 className='h-3.5 w-3.5' />}
              onClick={() => setDeleteTarget(row)}
              tone='danger'
            />
          </div>
        ),
      },
    ],
    [expandedRows, formatDate, resolvedTickersMap, router]
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
      const message = getAxiosMessage(error);
      if (message === MARKET_UNIVERSE_ACTIVE_BOT_DELETE_ERROR) {
        toast.error('Nie mozna usunac grupy rynkow, bo aktywny bot z niej korzysta', {
          description: 'Wylacz bota, a nastepnie usun grupe.',
        });
      } else {
        toast.error('Nie udalo sie usunac grupy rynkow', { description: message });
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <DataTable
        compact
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        filterPlaceholder='Filtruj grupy rynkow...'
        filterFn={(row, query) => {
          const normalized = query.trim().toUpperCase();
          return (
            row.name.toUpperCase().includes(normalized) ||
            (row.exchange ?? 'BINANCE').toUpperCase().includes(normalized) ||
            row.baseCurrency.toUpperCase().includes(normalized) ||
            row.marketType.toUpperCase().includes(normalized)
          );
        }}
        emptyText='Brak grup rynkow.'
        isRowExpanded={(row) => Boolean(expandedRows[row.id])}
        renderExpandedRow={(row) => {
          const resolved = resolvedTickersMap[row.id];
          if (!resolved || resolved.tickers.length === 0) {
            return <p className='text-sm opacity-70'>Brak tickerow po filtrach.</p>;
          }

          return (
            <div className='rounded-box border border-base-300 bg-base-200 p-3'>
              <p className='mb-2 text-sm font-medium'>
                Tickery ({resolved.tickers.length})
              </p>
              <div className='max-h-64 overflow-y-auto overflow-x-hidden'>
                <div className='flex flex-wrap gap-2'>
                  {resolved.tickers.map((symbol) => (
                    <span key={`${row.id}-${symbol}`} className='badge badge-outline font-mono'>
                      {symbol}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        }}
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
