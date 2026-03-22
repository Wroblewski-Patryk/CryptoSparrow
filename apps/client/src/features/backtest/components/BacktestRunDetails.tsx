'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { LuChartLine, LuDatabase, LuListChecks, LuLoaderCircle, LuShieldCheck } from 'react-icons/lu';
import {
  getBacktestRun,
  getBacktestRunReport,
  listBacktestRunTrades,
} from '../services/backtests.service';
import { BacktestReport, BacktestRun, BacktestTrade } from '../types/backtest.type';
import { EmptyState, ErrorState, LoadingState } from 'apps/client/src/ui/components/ViewState';
import { useLocaleFormatting } from 'apps/client/src/i18n/useLocaleFormatting';

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  return (err.response?.data as { message?: string } | undefined)?.message;
};

const pnlClass = (value: number | null) => {
  if (value == null) return '';
  if (value > 0) return 'text-success';
  if (value < 0) return 'text-error';
  return '';
};

const buildEquityCurve = (items: BacktestTrade[]) => {
  const sorted = [...items].sort((a, b) => (a.closedAt < b.closedAt ? -1 : 1));
  const points: number[] = [];
  let cumulative = 0;
  for (const trade of sorted) {
    cumulative += trade.pnl;
    points.push(cumulative);
  }
  return points;
};

const toSparklinePoints = (series: number[]) => {
  if (series.length === 0) return '';
  const width = 280;
  const height = 70;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;

  return series
    .map((value, index) => {
      const x = (index / Math.max(series.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');
};

type BacktestRunDetailsProps = {
  runId: string;
};

type LiveProgress = {
  leverage?: number;
  marginMode?: 'CROSSED' | 'ISOLATED' | 'NONE';
  totalSymbols?: number;
  processedSymbols?: number;
  failedSymbols?: string[];
  liquidations?: number;
  currentSymbol?: string | null;
  totalTrades?: number;
  netPnl?: number;
  grossProfit?: number;
  grossLoss?: number;
  maxDrawdown?: number;
  maxCandlesPerSymbol?: number;
  lastUpdate?: string;
};

export default function BacktestRunDetails({ runId }: BacktestRunDetailsProps) {
  const { formatCurrency, formatDateTime, formatNumber, formatPercent } = useLocaleFormatting();
  const [run, setRun] = useState<BacktestRun | null>(null);
  const [report, setReport] = useState<BacktestReport | null>(null);
  const [trades, setTrades] = useState<BacktestTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'trades' | 'raw'>('summary');

  const loadData = useCallback(async () => {
    try {
      const runData = await getBacktestRun(runId);
      setRun(runData);

      const [tradesData, reportData] = await Promise.all([
        listBacktestRunTrades(runId),
        getBacktestRunReport(runId),
      ]);

      setTrades(tradesData);
      setReport(reportData);
      setError(null);
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? 'Nie udalo sie pobrac danych backtestu.');
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    setLoading(true);
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!run || (run.status !== 'PENDING' && run.status !== 'RUNNING')) return;

    const timer = setInterval(() => {
      void loadData();
    }, 4000);

    return () => clearInterval(timer);
  }, [loadData, run]);

  const equityCurve = useMemo(() => buildEquityCurve(trades), [trades]);
  const equityCurvePoints = useMemo(() => toSparklinePoints(equityCurve), [equityCurve]);
  const liveProgress = ((run?.seedConfig as { liveProgress?: LiveProgress } | null)?.liveProgress ?? null) as LiveProgress | null;

  const progress = useMemo(() => {
    if (!run) return 0;
    if (liveProgress?.totalSymbols && liveProgress.totalSymbols > 0) {
      const bySymbols = Math.floor(((liveProgress.processedSymbols ?? 0) / liveProgress.totalSymbols) * 85);
      if (run.status === 'COMPLETED' || run.status === 'FAILED' || run.status === 'CANCELED') return 100;
      return Math.max(5, bySymbols);
    }
    if (run.status === 'PENDING') return 20;
    if (run.status === 'RUNNING') return 60;
    if (run.status === 'COMPLETED') return report ? 100 : 85;
    return 100;
  }, [liveProgress, report, run]);

  const stages = useMemo(
    () => [
      {
        label: 'Run utworzony',
        icon: <LuListChecks className='h-4 w-4' />,
        done: Boolean(run),
        active: !run,
      },
      {
        label: 'Silnik liczy wynik',
        icon: <LuLoaderCircle className='h-4 w-4' />,
        done: run?.status === 'RUNNING' || run?.status === 'COMPLETED' || run?.status === 'FAILED' || run?.status === 'CANCELED',
        active: run?.status === 'PENDING',
      },
      {
        label: 'Trade list gotowa',
        icon: <LuDatabase className='h-4 w-4' />,
        done: trades.length > 0 || run?.status === 'FAILED' || run?.status === 'CANCELED' || run?.status === 'COMPLETED',
        active: run?.status === 'RUNNING' && trades.length === 0,
      },
      {
        label: 'Raport i wykres',
        icon: <LuChartLine className='h-4 w-4' />,
        done: Boolean(report) || run?.status === 'FAILED' || run?.status === 'CANCELED',
        active: run?.status === 'COMPLETED' && !report,
      },
      {
        label: 'Backtest zakonczony',
        icon: <LuShieldCheck className='h-4 w-4' />,
        done: run?.status === 'COMPLETED' || run?.status === 'FAILED' || run?.status === 'CANCELED',
        active: run?.status === 'RUNNING',
      },
    ],
    [report, run, trades.length]
  );

  if (loading) return <LoadingState title='Ladowanie szczegolow backtestu' />;
  if (error) {
    return (
      <ErrorState
        title='Nie udalo sie pobrac szczegolow backtestu'
        description={error}
        retryLabel='Sprobuj ponownie'
        onRetry={() => {
          setLoading(true);
          void loadData();
        }}
      />
    );
  }
  if (!run) return <EmptyState title='Nie znaleziono runa' description='Wybrany run nie istnieje albo nie masz do niego dostepu.' />;

  return (
    <div className='space-y-4'>
      <section className='rounded-xl border border-base-300 bg-base-100 p-4 space-y-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <h2 className='text-lg font-semibold'>{run.name}</h2>
          <span className='badge badge-outline'>{run.status}</span>
        </div>

        <div className='text-sm opacity-80 flex flex-wrap gap-x-4 gap-y-1'>
          <p>Symbol: <span className='font-medium'>{run.symbol}</span></p>
          <p>Interwal: <span className='font-medium'>{run.timeframe}</span></p>
          <p>Start: <span className='font-medium'>{formatDateTime(run.startedAt)}</span></p>
        </div>

        <progress className='progress progress-primary w-full' value={progress} max={100} />

        {liveProgress ? (
          <div className='rounded-lg border border-base-300 bg-base-200 p-3 text-sm'>
            <div className='grid gap-2 md:grid-cols-2 xl:grid-cols-4'>
              <p>Symboli: <span className='font-medium'>{liveProgress.processedSymbols ?? 0}/{liveProgress.totalSymbols ?? 0}</span></p>
              <p>Aktualny: <span className='font-medium'>{liveProgress.currentSymbol ?? '-'}</span></p>
              <p>Trade'y: <span className='font-medium'>{formatNumber(liveProgress.totalTrades ?? 0)}</span></p>
              <p>Net PnL (live): <span className={`font-medium ${pnlClass(liveProgress.netPnl ?? null)}`}>{formatCurrency(liveProgress.netPnl ?? 0)}</span></p>
            </div>
            <p className='mt-1 opacity-70'>
              Leverage: {liveProgress.leverage ?? 1}x | Margin: {liveProgress.marginMode ?? 'NONE'} | Liquidations: {liveProgress.liquidations ?? 0}
            </p>
            <p className='opacity-70'>
              Max candles/rynek: {liveProgress.maxCandlesPerSymbol ?? '-'} | Fail symboli: {(liveProgress.failedSymbols ?? []).length}
            </p>
          </div>
        ) : null}

        <ul className='steps steps-vertical lg:steps-horizontal w-full'>
          {stages.map((stage) => (
            <li key={stage.label} className={`step ${stage.done ? 'step-primary' : ''}`}>
              <span className={`inline-flex items-center gap-2 ${stage.active ? 'animate-pulse' : ''}`}>
                {stage.icon}
                {stage.label}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className='rounded-xl border border-base-300 bg-base-100 p-4'>
        <div role='tablist' className='tabs tabs-boxed'>
          <button
            type='button'
            className={`tab ${activeTab === 'summary' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            Summary
          </button>
          <button
            type='button'
            className={`tab ${activeTab === 'trades' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('trades')}
          >
            Trades
          </button>
          <button
            type='button'
            className={`tab ${activeTab === 'raw' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('raw')}
          >
            Raw
          </button>
        </div>

        {activeTab === 'summary' ? (
          <div className='mt-4 space-y-3'>
            {!report ? (
              <EmptyState
                title='Raport nie jest jeszcze gotowy'
                description='Po zakonczeniu runa raport pojawi sie automatycznie.'
              />
            ) : (
              <>
                <div className='grid gap-2 md:grid-cols-2 xl:grid-cols-4'>
                  <div className='stat bg-base-200 rounded-lg p-3'>
                    <div className='stat-title'>Net PnL</div>
                    <div className={`stat-value text-xl ${pnlClass(report.netPnl)}`}>{formatCurrency(report.netPnl)}</div>
                  </div>
                  <div className='stat bg-base-200 rounded-lg p-3'>
                    <div className='stat-title'>Win Rate</div>
                    <div className='stat-value text-xl'>{formatPercent(report.winRate)}</div>
                  </div>
                  <div className='stat bg-base-200 rounded-lg p-3'>
                    <div className='stat-title'>Total Trades</div>
                    <div className='stat-value text-xl'>{formatNumber(report.totalTrades)}</div>
                  </div>
                  <div className='stat bg-base-200 rounded-lg p-3'>
                    <div className='stat-title'>Max Drawdown</div>
                    <div className='stat-value text-xl'>{formatPercent(report.maxDrawdown)}</div>
                  </div>
                </div>

                <div className='rounded-lg border border-base-300 bg-base-200 p-3'>
                  <p className='text-sm font-medium'>Equity curve</p>
                  {equityCurvePoints ? (
                    <svg className='mt-2 h-[90px] w-full' viewBox='0 0 280 70' preserveAspectRatio='none'>
                      <polyline
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='2'
                        className={(report.netPnl ?? 0) >= 0 ? 'text-success' : 'text-error'}
                        points={equityCurvePoints}
                      />
                    </svg>
                  ) : (
                    <p className='mt-2 text-sm opacity-70'>Brak danych trades do narysowania wykresu.</p>
                  )}
                </div>
              </>
            )}
          </div>
        ) : null}

        {activeTab === 'trades' ? (
          <div className='mt-4'>
            {trades.length === 0 ? (
              <EmptyState title='Brak trades' description='Dla tego runa nie ma jeszcze transakcji.' />
            ) : (
              <div className='overflow-x-auto'>
                <table className='table table-zebra table-sm'>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Side</th>
                      <th>Entry</th>
                      <th>Exit</th>
                      <th>PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((trade) => (
                      <tr key={trade.id}>
                        <td>{trade.symbol}</td>
                        <td>{trade.side}</td>
                        <td>{formatNumber(trade.entryPrice)}</td>
                        <td>{formatNumber(trade.exitPrice)}</td>
                        <td className={trade.pnl >= 0 ? 'text-success' : 'text-error'}>{formatCurrency(trade.pnl)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {activeTab === 'raw' ? (
          <pre className='mockup-code mt-4 whitespace-pre-wrap text-xs'>
            {JSON.stringify({ run, report, trades: trades.slice(0, 50) }, null, 2)}
          </pre>
        ) : null}
      </section>
    </div>
  );
}
