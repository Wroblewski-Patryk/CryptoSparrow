'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '../../../ui/components/ViewState';
import { useLocaleFormatting } from '../../../i18n/useLocaleFormatting';
import {
  createMarketUniverse,
  deleteMarketUniverse,
  listMarketUniverses,
} from '../services/markets.service';
import { MarketUniverse } from '../types/marketUniverse.type';

const parseSymbolsInput = (value: string) =>
  value
    .split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  return (err.response?.data as { message?: string } | undefined)?.message;
};

export default function MarketsFlow() {
  const { formatDate } = useLocaleFormatting();
  const [universes, setUniverses] = useState<MarketUniverse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('USDT');
  const [whitelistInput, setWhitelistInput] = useState('');
  const [blacklistInput, setBlacklistInput] = useState('');

  const loadUniverses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listMarketUniverses();
      setUniverses(data);
    } catch (err: unknown) {
      const message = getAxiosMessage(err) ?? 'Nie udalo sie pobrac listy market universes.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUniverses();
  }, [loadUniverses]);

  const canSubmit = useMemo(() => name.trim().length > 0 && !creating, [creating, name]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setCreating(true);
    try {
      const created = await createMarketUniverse({
        name: name.trim(),
        baseCurrency: baseCurrency.trim().toUpperCase(),
        whitelist: parseSymbolsInput(whitelistInput),
        blacklist: parseSymbolsInput(blacklistInput),
      });

      setUniverses((prev) => [created, ...prev]);
      setName('');
      setWhitelistInput('');
      setBlacklistInput('');
      toast.success('Market universe utworzony');
    } catch (err: unknown) {
      toast.error('Nie udalo sie utworzyc market universe', {
        description: getAxiosMessage(err),
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteMarketUniverse(id);
      setUniverses((prev) => prev.filter((item) => item.id !== id));
      toast.success('Market universe usuniety');
    } catch (err: unknown) {
      toast.error('Nie udalo sie usunac market universe', {
        description: getAxiosMessage(err),
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className='space-y-5'>
      <form onSubmit={handleCreate} className='rounded-xl border border-base-300 bg-base-200 p-4'>
        <h2 className='text-lg font-semibold'>Nowy market universe</h2>
        <p className='text-sm opacity-70'>Whitelist i blacklist podaj jako symbole oddzielone przecinkami.</p>

        <div className='mt-4 grid gap-3 md:grid-cols-2'>
          <label className='form-control'>
            <span className='label-text'>Nazwa</span>
            <input
              className='input input-bordered'
              placeholder='Top Futures'
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <label className='form-control'>
            <span className='label-text'>Base currency</span>
            <input
              className='input input-bordered'
              placeholder='USDT'
              value={baseCurrency}
              onChange={(event) => setBaseCurrency(event.target.value)}
            />
          </label>

          <label className='form-control md:col-span-2'>
            <span className='label-text'>Whitelist</span>
            <input
              className='input input-bordered'
              placeholder='BTCUSDT, ETHUSDT'
              value={whitelistInput}
              onChange={(event) => setWhitelistInput(event.target.value)}
            />
          </label>

          <label className='form-control md:col-span-2'>
            <span className='label-text'>Blacklist</span>
            <input
              className='input input-bordered'
              placeholder='1000BONKUSDT, XRPUSDT'
              value={blacklistInput}
              onChange={(event) => setBlacklistInput(event.target.value)}
            />
          </label>
        </div>

        <div className='mt-4 flex justify-end'>
          <button type='submit' className='btn btn-primary btn-sm' disabled={!canSubmit}>
            {creating ? 'Tworzenie...' : 'Dodaj universe'}
          </button>
        </div>
      </form>

      {loading && <LoadingState title='Ladowanie market universes' />}
      {!loading && error && (
        <ErrorState
          title='Nie udalo sie pobrac market universes'
          description={error}
          retryLabel='Sprobuj ponownie'
          onRetry={() => void loadUniverses()}
        />
      )}
      {!loading && !error && universes.length === 0 && (
        <EmptyState
          title='Brak market universes'
          description='Dodaj pierwszy universe, aby przygotowac selekcje symboli dla botow.'
        />
      )}

      {!loading && !error && universes.length > 0 && (
        <div className='space-y-3'>
          <SuccessState
            title='Market universes aktywne'
            description={`Skonfigurowano ${universes.length} ${universes.length === 1 ? 'universe' : 'universes'}.`}
          />
          <div className='overflow-x-auto'>
            <table className='table table-zebra'>
              <thead>
                <tr>
                  <th>Nazwa</th>
                  <th>Base</th>
                  <th>Whitelist</th>
                  <th>Blacklist</th>
                  <th>Utworzono</th>
                  <th>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {universes.map((item) => (
                  <tr key={item.id}>
                    <td className='font-medium'>{item.name}</td>
                    <td>{item.baseCurrency}</td>
                    <td>{item.whitelist.join(', ') || '-'}</td>
                    <td>{item.blacklist.join(', ') || '-'}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <button
                        type='button'
                        className='btn btn-error btn-xs'
                        onClick={() => void handleDelete(item.id)}
                        disabled={deletingId === item.id}
                      >
                        {deletingId === item.id ? 'Usuwanie...' : 'Usun'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
