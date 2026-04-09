'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  const payload = err.response?.data as
    | {
        message?: string;
        error?: {
          message?: string;
        };
      }
    | undefined;
  return payload?.error?.message ?? payload?.message;
};

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
  const lastMarketUniverseIdRef = useRef<string | null>(null);

  useEffect(() => {
    lastMarketUniverseIdRef.current = null;
    setMarketUniverseName(null);
  }, [runId]);

  const loadData = useCallback(async () => {
    const normalizedRunId = runId.trim();
    if (!normalizedRunId) {
      setRun(null);
      setReport(null);
      setTrades([]);
      setStrategy(null);
      setMarketUniverseName(null);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      const runData = await getBacktestRun(normalizedRunId);
      setRun(runData);

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
        setRun(null);
        setReport(null);
        setTrades([]);
        setStrategy(null);
        setMarketUniverseName(null);
        setError(null);
        return;
      }
      setError(getAxiosMessage(err) ?? loadErrorDefault);
    } finally {
      setLoading(false);
    }
  }, [loadErrorDefault, runId]);

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
    setLoading(true);
    void loadData();
  }, [loadData]);

  return {
    run,
    report,
    trades,
    strategy,
    marketUniverseName,
    loading,
    error,
    retry,
  };
};
