'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  getBacktestRun,
  getBacktestRunReport,
  listBacktestRunTrades,
} from '../services/backtests.service';
import { BacktestReport, BacktestRun, BacktestTrade } from '../types/backtest.type';
import { getStrategy } from '../../strategies/api/strategies.api';
import { StrategyDto } from '../../strategies/types/StrategyForm.type';
import { getMarketUniverse } from '../../markets/services/markets.service';
import { getAxiosMessage } from '@/lib/getAxiosMessage';
import { normalizeSymbol } from '@/lib/symbols';
import { buildBacktestSymbolStats, groupBacktestTradesBySymbol } from '../utils/backtestSymbolStats';

const BOOTSTRAP_RETRY_DELAY_MS = 1500;
const MAX_BOOTSTRAP_RETRIES = 8;

type UseBacktestRunCoreDataParams = {
  runId: string;
  loadErrorDefault: string;
};

export const useBacktestRunCoreData = ({
  runId,
  loadErrorDefault,
}: UseBacktestRunCoreDataParams) => {
  const [run, setRun] = useState<BacktestRun | null>(null);
  const [report, setReport] = useState<BacktestReport | null>(null);
  const [trades, setTrades] = useState<BacktestTrade[]>([]);
  const [strategy, setStrategy] = useState<StrategyDto | null>(null);
  const [marketUniverseName, setMarketUniverseName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const runRef = useRef<BacktestRun | null>(null);
  const lastMarketUniverseIdRef = useRef<string | null>(null);
  const bootstrapRetryAttemptsRef = useRef(0);
  const bootstrapRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isTransientBootstrapError = useCallback((err: unknown) => {
    if (!axios.isAxiosError(err)) return false;
    const statusCode = err.response?.status;
    if (statusCode == null) return true;
    return [408, 425, 429, 500, 502, 503, 504].includes(statusCode);
  }, []);

  const clearBootstrapRetryTimer = useCallback(() => {
    if (bootstrapRetryTimerRef.current) {
      clearTimeout(bootstrapRetryTimerRef.current);
      bootstrapRetryTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    runRef.current = null;
    lastMarketUniverseIdRef.current = null;
    bootstrapRetryAttemptsRef.current = 0;
    clearBootstrapRetryTimer();
    setMarketUniverseName(null);
    return () => {
      clearBootstrapRetryTimer();
    };
  }, [clearBootstrapRetryTimer, runId]);

  const loadData = useCallback(async () => {
    const normalizedRunId = runId.trim();
    clearBootstrapRetryTimer();
    if (!normalizedRunId) {
      bootstrapRetryAttemptsRef.current = 0;
      setRun(null);
      runRef.current = null;
      setReport(null);
      setTrades([]);
      setStrategy(null);
      setMarketUniverseName(null);
      setError(null);
      setLoading(false);
      return;
    }

    let keepLoading = false;
    try {
      const runData = await getBacktestRun(normalizedRunId);
      bootstrapRetryAttemptsRef.current = 0;
      setRun(runData);
      runRef.current = runData;

      const [tradesResult, reportResult] = await Promise.allSettled([
        listBacktestRunTrades(normalizedRunId),
        getBacktestRunReport(normalizedRunId),
      ]);

      if (tradesResult.status === 'fulfilled') {
        setTrades(Array.isArray(tradesResult.value) ? tradesResult.value : []);
      }
      if (reportResult.status === 'fulfilled') {
        setReport(reportResult.value);
      }

      if (runData.strategyId) {
        try {
          const strategyData = await getStrategy(runData.strategyId);
          setStrategy(strategyData);
        } catch {
          setStrategy(null);
        }
      } else {
        setStrategy(null);
      }

      const runSeedConfig = (runData.seedConfig as { marketUniverseId?: unknown } | null) ?? null;
      const marketUniverseId =
        runSeedConfig && typeof runSeedConfig.marketUniverseId === 'string'
          ? runSeedConfig.marketUniverseId
          : null;
      if (marketUniverseId) {
        if (lastMarketUniverseIdRef.current !== marketUniverseId) {
          try {
            const universe = await getMarketUniverse(marketUniverseId);
            setMarketUniverseName(universe.name);
            lastMarketUniverseIdRef.current = marketUniverseId;
          } catch {
            setMarketUniverseName(null);
          }
        }
      } else {
        lastMarketUniverseIdRef.current = null;
        setMarketUniverseName(null);
      }

      setError(null);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        // Run no longer exists or is not accessible for this user.
        bootstrapRetryAttemptsRef.current = 0;
        setRun(null);
        runRef.current = null;
        setReport(null);
        setTrades([]);
        setStrategy(null);
        setMarketUniverseName(null);
        setError(null);
        return;
      }

      if (isTransientBootstrapError(err) && !runRef.current) {
        if (
          bootstrapRetryAttemptsRef.current < MAX_BOOTSTRAP_RETRIES
        ) {
          bootstrapRetryAttemptsRef.current += 1;
          keepLoading = true;
          setError(null);
          bootstrapRetryTimerRef.current = setTimeout(() => {
            void loadData();
          }, BOOTSTRAP_RETRY_DELAY_MS);
          return;
        }
      }
      if (runRef.current) {
        // Keep already-loaded run data visible on refresh errors.
        setError(null);
        return;
      }
      setError(getAxiosMessage(err) ?? loadErrorDefault);
    } finally {
      if (!keepLoading) {
        setLoading(false);
      }
    }
  }, [clearBootstrapRetryTimer, isTransientBootstrapError, loadErrorDefault, runId]);

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

  const retry = useCallback(() => {
    bootstrapRetryAttemptsRef.current = 0;
    clearBootstrapRetryTimer();
    setLoading(true);
    void loadData();
  }, [clearBootstrapRetryTimer, loadData]);

  const configuredRunSymbols = useMemo(() => {
    const symbols = ((run?.seedConfig as { symbols?: unknown } | null)?.symbols ?? null) as string[] | null;
    if (!Array.isArray(symbols)) return [];
    return [...new Set(symbols.map((symbol) => normalizeSymbol(symbol)).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [run?.seedConfig]);

  const runSymbolStats = useMemo(
    () => buildBacktestSymbolStats(trades, configuredRunSymbols),
    [configuredRunSymbols, trades],
  );
  const runTradesBySymbol = useMemo(() => groupBacktestTradesBySymbol(trades), [trades]);

  return {
    run,
    report,
    trades,
    runSymbolStats,
    runTradesBySymbol,
    strategy,
    marketUniverseName,
    loading,
    error,
    retry,
  };
};
