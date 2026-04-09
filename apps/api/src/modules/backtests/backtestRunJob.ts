import { PositionSide } from '@prisma/client';
import { BacktestFillModelConfig } from './backtestFillModel';
import {
  BacktestKlineCandle,
  BacktestMarketType,
  BacktestSupplementalSeries,
} from './backtestDataGateway';

type MarginMode = 'CROSSED' | 'ISOLATED' | 'NONE';

type ProgressState = {
  marketType: BacktestMarketType;
  leverage: number;
  marginMode: MarginMode;
  marketUniverseId: string | null;
  totalSymbols: number;
  processedSymbols: number;
  failedSymbols: string[];
  liquidations: number;
  currentSymbol: string | null;
  totalTrades: number;
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
  maxDrawdown: number;
  maxCandlesPerSymbol: number;
  totalCandlesForSymbol?: number;
  currentCandleIndex?: number;
  currentCandleTime?: string | null;
  startedAt: string;
  updatedAt: string;
  lastUpdate: string;
};

type LifecycleEventCounts = {
  ENTRY: number;
  EXIT: number;
  DCA: number;
  TP: number;
  TTP: number;
  SL: number;
  TRAILING: number;
  LIQUIDATION: number;
};

type SimulationTrade = {
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  openedAt: Date;
  closedAt: Date;
  pnl: number;
  fee: number;
  exitReason: 'SIGNAL_EXIT' | 'FINAL_CANDLE' | 'LIQUIDATION';
  liquidated: boolean;
};

type SimulationTrace = {
  timestamp: Date;
  side: PositionSide | null;
  trigger: 'STRATEGY' | 'THRESHOLD' | 'FINAL_CANDLE';
  mismatchReason:
    | 'no_open_position'
    | 'no_flip_with_open_position'
    | 'already_open_same_side'
    | 'manual_managed_symbol'
    | null;
};

type SimulationPerSymbol = {
  trades: SimulationTrade[];
  liquidations: number;
  eventCounts: LifecycleEventCounts;
  decisionTrace: SimulationTrace[];
};

type SimulationResult = {
  perSymbol: Record<string, SimulationPerSymbol>;
};

type BacktestRunRecord = {
  id: string;
  userId: string;
  symbol: string;
  timeframe: string;
  strategyId: string | null;
  seedConfig: unknown;
};

type StrategySignalConfigRecord = {
  config: unknown;
  walletRisk: number | null;
};

type CreateTradeInput = {
  userId: string;
  strategyId: string | null;
  backtestRunId: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  openedAt: Date;
  closedAt: Date;
  pnl: number;
  fee: number;
  exitReason: 'SIGNAL_EXIT' | 'FINAL_CANDLE' | 'LIQUIDATION';
  liquidated: boolean;
};

type BacktestRunJobDeps = {
  findBacktestRunById: (runId: string) => Promise<BacktestRunRecord | null>;
  safeUpdateRun: (runId: string, data: Record<string, unknown>) => Promise<boolean>;
  uniqueSorted: (values: string[]) => string[];
  computeAdaptiveMaxCandles: (timeframe: string, symbolCount: number, requested?: number) => number;
  resolveIndicatorWarmupCandles: (strategyConfig: unknown) => number;
  normalizeWalletRiskPercent: (walletRiskPercent: number, fallbackPercent?: number) => number;
  parseStrategySignalRules: (strategyConfig?: Record<string, unknown> | null) => unknown;
  findOwnedStrategySignalConfig: (
    userId: string,
    strategyId: string,
  ) => Promise<StrategySignalConfigRecord | null>;
  fetchKlines: (
    symbol: string,
    timeframe: string,
    marketType: BacktestMarketType,
    maxCandles: number,
    endTimeMs?: number,
  ) => Promise<BacktestKlineCandle[]>;
  fetchSupplementalSeries: (
    symbol: string,
    timeframe: string,
    marketType: BacktestMarketType,
    maxCandles: number,
    endTimeMs?: number,
  ) => Promise<BacktestSupplementalSeries>;
  simulateInterleavedPortfolio: (input: {
    symbols: string[];
    candlesBySymbol: Map<string, BacktestKlineCandle[]>;
    supplementalBySymbol?: Map<string, BacktestSupplementalSeries>;
    analysisStartIndexBySymbol?: Map<string, number>;
    marketType: BacktestMarketType;
    leverage: number;
    marginMode: MarginMode;
    strategyConfig?: Record<string, unknown> | null;
    fillModelConfig?: BacktestFillModelConfig;
    walletRiskPercent: number;
    initialBalance: number;
  }) => SimulationResult;
  createBacktestTrades: (trades: CreateTradeInput[]) => Promise<unknown>;
  countWinningBacktestTrades: (userId: string, runId: string) => Promise<number>;
  countLosingBacktestTrades: (userId: string, runId: string) => Promise<number>;
  upsertBacktestReportForRun: (input: any) => Promise<unknown>;
  computeSourceWindowMs: (timeframe: string, maxCandles: number) => number;
  maxDrawdownFromPnlSeries: (pnls: number[]) => number;
};

const emptyLifecycleEventCounts = (): LifecycleEventCounts => ({
  ENTRY: 0,
  EXIT: 0,
  DCA: 0,
  TP: 0,
  TTP: 0,
  SL: 0,
  TRAILING: 0,
  LIQUIDATION: 0,
});

const updateRunProgress = async (
  deps: BacktestRunJobDeps,
  runId: string,
  existingSeed: Record<string, unknown> | null,
  progress: ProgressState,
) => {
  await deps.safeUpdateRun(runId, {
    seedConfig: {
      ...(existingSeed ?? {}),
      liveProgress: progress,
    },
  });
};

export const createBacktestRunJob = (deps: BacktestRunJobDeps) =>
  async (runId: string) => {
    const run = await deps.findBacktestRunById(runId);
    if (!run) return;

    const seed = ((run.seedConfig ?? {}) as Record<string, unknown>) ?? {};
    const symbolListRaw = Array.isArray(seed.symbols) ? (seed.symbols as string[]) : [run.symbol];
    const symbols = deps.uniqueSorted(symbolListRaw);
    const marketType = (seed.marketType === 'SPOT' ? 'SPOT' : 'FUTURES') as BacktestMarketType;
    const leverageCandidate = Number((seed as { leverage?: unknown }).leverage);
    const leverage = Number.isFinite(leverageCandidate) ? leverageCandidate : 1;
    const marginMode =
      seed.marginMode === 'ISOLATED'
        ? 'ISOLATED'
        : seed.marginMode === 'CROSSED'
          ? 'CROSSED'
          : 'NONE';
    const initialBalanceCandidate = Number((seed as { initialBalance?: unknown }).initialBalance);
    const initialBalance = Number.isFinite(initialBalanceCandidate)
      ? Math.max(0, initialBalanceCandidate)
      : 10_000;
    const maxCandlesPerSymbol = deps.computeAdaptiveMaxCandles(
      run.timeframe,
      symbols.length,
      typeof seed.maxCandles === 'number' ? seed.maxCandles : undefined,
    );

    const progress: ProgressState = {
      marketType,
      leverage: marketType === 'SPOT' ? 1 : Math.max(1, leverage),
      marginMode: marketType === 'SPOT' ? 'NONE' : marginMode,
      marketUniverseId: typeof seed.marketUniverseId === 'string' ? seed.marketUniverseId : null,
      totalSymbols: symbols.length,
      processedSymbols: 0,
      failedSymbols: [],
      liquidations: 0,
      currentSymbol: symbols[0] ?? null,
      totalTrades: 0,
      netPnl: 0,
      grossProfit: 0,
      grossLoss: 0,
      maxDrawdown: 0,
      maxCandlesPerSymbol,
      totalCandlesForSymbol: 0,
      currentCandleIndex: 0,
      currentCandleTime: null,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastUpdate: 'starting',
    };

    const runExists = await deps.safeUpdateRun(runId, {
      status: 'RUNNING',
      seedConfig: {
        ...seed,
        liveProgress: progress,
      },
    });
    if (!runExists) return;

    const pnlSeries: number[] = [];
    const lifecycleEventCounts = emptyLifecycleEventCounts();
    const strategy = run.strategyId
      ? await deps.findOwnedStrategySignalConfig(run.userId, run.strategyId)
      : null;
    const strategyConfig = (strategy?.config as Record<string, unknown> | undefined) ?? null;
    const indicatorWarmupCandles = deps.resolveIndicatorWarmupCandles(strategyConfig);
    const strategyWalletRisk = deps.normalizeWalletRiskPercent(strategy?.walletRisk ?? 1, 1);
    const strategyRulesActive = Boolean(deps.parseStrategySignalRules(strategyConfig));
    const fillModelConfig: BacktestFillModelConfig = {
      feeRate:
        typeof (seed as { feeRate?: unknown }).feeRate === 'number'
          ? Number((seed as { feeRate?: unknown }).feeRate)
          : undefined,
      slippageRate:
        typeof (seed as { slippageRate?: unknown }).slippageRate === 'number'
          ? Number((seed as { slippageRate?: unknown }).slippageRate)
          : undefined,
      fundingRate:
        typeof (seed as { fundingRate?: unknown }).fundingRate === 'number'
          ? Number((seed as { fundingRate?: unknown }).fundingRate)
          : undefined,
    };
    const symbolInputCoverage: Array<{
      symbol: string;
      candles: number;
      fundingPoints: number;
      openInterestPoints: number;
      orderBookPoints: number;
    }> = [];
    const parityDiagnostics: Array<{
      symbol: string;
      status: 'PROCESSED' | 'FAILED';
      strategyRulesActive: boolean;
      entryEvents: number;
      closeEvents: number;
      liquidationEvents: number;
      mismatchCount: number;
      mismatchSamples: Array<{
        timestamp: string;
        side: PositionSide | null;
        trigger: 'STRATEGY' | 'THRESHOLD' | 'FINAL_CANDLE';
        mismatchReason:
          | 'no_open_position'
          | 'no_flip_with_open_position'
          | 'already_open_same_side'
          | 'manual_managed_symbol';
      }>;
      fundingPoints: number;
      openInterestPoints: number;
      orderBookPoints: number;
      error: string | null;
    }> = [];

    try {
      const candlesBySymbol = new Map<string, BacktestKlineCandle[]>();
      const supplementalBySymbol = new Map<string, BacktestSupplementalSeries>();

      for (const [index, symbol] of symbols.entries()) {
        progress.currentSymbol = symbol;
        progress.lastUpdate = `loading_${symbol}`;
        progress.updatedAt = new Date().toISOString();
        await updateRunProgress(deps, runId, seed, progress);

        try {
          const candles = await deps.fetchKlines(
            symbol,
            run.timeframe,
            marketType,
            maxCandlesPerSymbol + indicatorWarmupCandles,
          );
          if (candles.length === 0) {
            throw new Error('NO_CANDLES_AVAILABLE_FOR_SYMBOL');
          }
          const supplemental = await deps.fetchSupplementalSeries(
            symbol,
            run.timeframe,
            marketType,
            maxCandlesPerSymbol + indicatorWarmupCandles,
          );
          candlesBySymbol.set(symbol, candles);
          supplementalBySymbol.set(symbol, supplemental);
          symbolInputCoverage.push({
            symbol,
            candles: candles.length,
            fundingPoints: supplemental.fundingRates.length,
            openInterestPoints: supplemental.openInterest.length,
            orderBookPoints: supplemental.orderBook.length,
          });
          progress.totalCandlesForSymbol = candles.length;
          progress.currentCandleIndex = candles.length > 0 ? candles.length - 1 : 0;
          progress.currentCandleTime =
            candles.length > 0 ? new Date(candles[candles.length - 1].openTime).toISOString() : null;
          progress.updatedAt = new Date().toISOString();
          await updateRunProgress(deps, runId, seed, progress);
        } catch (error) {
          progress.failedSymbols.push(symbol);
          parityDiagnostics.push({
            symbol,
            status: 'FAILED',
            strategyRulesActive,
            entryEvents: 0,
            closeEvents: 0,
            liquidationEvents: 0,
            mismatchCount: 0,
            mismatchSamples: [],
            fundingPoints: 0,
            openInterestPoints: 0,
            orderBookPoints: 0,
            error: error instanceof Error ? error.message : 'UNKNOWN_SYMBOL_PROCESSING_ERROR',
          });
        }

        progress.processedSymbols = index + 1;
        progress.lastUpdate = `processed_${symbol}`;
        progress.updatedAt = new Date().toISOString();
        await updateRunProgress(deps, runId, seed, progress);
      }

      const loadedSymbols = symbols.filter((symbol) => candlesBySymbol.has(symbol));
      if (loadedSymbols.length > 0) {
        progress.currentSymbol = 'INTERLEAVED_PORTFOLIO_CLOCK';
        progress.lastUpdate = 'simulating_interleaved_portfolio';
        progress.updatedAt = new Date().toISOString();
        await updateRunProgress(deps, runId, seed, progress);

        const simulation = deps.simulateInterleavedPortfolio({
          symbols: loadedSymbols,
          candlesBySymbol,
          supplementalBySymbol,
          analysisStartIndexBySymbol: new Map(
            loadedSymbols.map((symbol) => {
              const symbolCandles = candlesBySymbol.get(symbol) ?? [];
              const startIndex = Math.max(1, symbolCandles.length - maxCandlesPerSymbol);
              return [symbol, startIndex];
            }),
          ),
          marketType,
          leverage: progress.leverage,
          marginMode: progress.marginMode,
          strategyConfig,
          fillModelConfig,
          walletRiskPercent: strategyWalletRisk,
          initialBalance,
        });

        for (const symbol of loadedSymbols) {
          const symbolSimulation = simulation.perSymbol[symbol];
          if (!symbolSimulation) continue;
          const supplemental = supplementalBySymbol.get(symbol) ?? {
            fundingRates: [],
            openInterest: [],
            orderBook: [],
          };
          const decisionTrace = Array.isArray(symbolSimulation.decisionTrace)
            ? symbolSimulation.decisionTrace
            : [];
          for (const [key, value] of Object.entries(symbolSimulation.eventCounts)) {
            lifecycleEventCounts[key as keyof LifecycleEventCounts] += value;
          }
          parityDiagnostics.push({
            symbol,
            status: 'PROCESSED',
            strategyRulesActive,
            entryEvents: symbolSimulation.eventCounts.ENTRY,
            closeEvents:
              symbolSimulation.eventCounts.EXIT +
              symbolSimulation.eventCounts.TP +
              symbolSimulation.eventCounts.TTP +
              symbolSimulation.eventCounts.SL +
              symbolSimulation.eventCounts.TRAILING,
            liquidationEvents: symbolSimulation.eventCounts.LIQUIDATION,
            mismatchCount: decisionTrace.filter((entry) => entry.mismatchReason !== null).length,
            mismatchSamples: decisionTrace
              .filter((entry) => entry.mismatchReason !== null)
              .slice(0, 25)
              .map((entry) => ({
                timestamp: entry.timestamp.toISOString(),
                side: entry.side,
                trigger: entry.trigger,
                mismatchReason: entry.mismatchReason as
                  | 'no_open_position'
                  | 'no_flip_with_open_position'
                  | 'already_open_same_side'
                  | 'manual_managed_symbol',
              })),
            fundingPoints: supplemental.fundingRates.length,
            openInterestPoints: supplemental.openInterest.length,
            orderBookPoints: supplemental.orderBook.length,
            error: null,
          });

          const trades = symbolSimulation.trades;
          if (trades.length > 0) {
            await deps.createBacktestTrades(
              trades.map((trade) => ({
                userId: run.userId,
                strategyId: run.strategyId,
                backtestRunId: run.id,
                symbol: trade.symbol,
                side: trade.side,
                entryPrice: trade.entryPrice,
                exitPrice: trade.exitPrice,
                quantity: trade.quantity,
                openedAt: trade.openedAt,
                closedAt: trade.closedAt,
                pnl: trade.pnl,
                fee: trade.fee,
                exitReason: trade.exitReason,
                liquidated: trade.liquidated,
              })),
            );

            for (const trade of trades) {
              progress.totalTrades += 1;
              progress.netPnl += trade.pnl;
              if (trade.pnl > 0) progress.grossProfit += trade.pnl;
              if (trade.pnl < 0) progress.grossLoss += Math.abs(trade.pnl);
              pnlSeries.push(trade.pnl);
            }
          }
          progress.liquidations += symbolSimulation.liquidations;
        }
        progress.maxDrawdown = deps.maxDrawdownFromPnlSeries(pnlSeries);
      }

      const totalTrades = progress.totalTrades;
      const winningTrades = await deps.countWinningBacktestTrades(run.userId, run.id);
      const losingTrades = await deps.countLosingBacktestTrades(run.userId, run.id);
      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : null;
      const sourceWindowDays = Math.max(
        14,
        Math.ceil(deps.computeSourceWindowMs(run.timeframe, maxCandlesPerSymbol) / (24 * 60 * 60 * 1000)),
      );

      await deps.upsertBacktestReportForRun({
        backtestRunId: run.id,
        create: {
          userId: run.userId,
          backtestRunId: run.id,
          totalTrades,
          winningTrades,
          losingTrades,
          winRate,
          netPnl: progress.netPnl,
          grossProfit: progress.grossProfit,
          grossLoss: progress.grossLoss,
          maxDrawdown: progress.maxDrawdown,
          sharpe: null,
          metrics: {
            symbolsProcessed: progress.processedSymbols,
            symbolsFailed: progress.failedSymbols,
            maxCandlesPerSymbol,
            historicalInputs: {
              sourceWindowDays,
              symbolCoverage: symbolInputCoverage,
            },
            parityDiagnostics,
            leverage: progress.leverage,
            marginMode: progress.marginMode,
            liquidations: progress.liquidations,
            lifecycleEventCounts,
            initialBalance,
            endBalance: Math.max(0, initialBalance + progress.netPnl),
          },
        },
        update: {
          totalTrades,
          winningTrades,
          losingTrades,
          winRate,
          netPnl: progress.netPnl,
          grossProfit: progress.grossProfit,
          grossLoss: progress.grossLoss,
          maxDrawdown: progress.maxDrawdown,
          metrics: {
            symbolsProcessed: progress.processedSymbols,
            symbolsFailed: progress.failedSymbols,
            maxCandlesPerSymbol,
            historicalInputs: {
              sourceWindowDays,
              symbolCoverage: symbolInputCoverage,
            },
            parityDiagnostics,
            leverage: progress.leverage,
            marginMode: progress.marginMode,
            liquidations: progress.liquidations,
            lifecycleEventCounts,
            initialBalance,
            endBalance: Math.max(0, initialBalance + progress.netPnl),
          },
        },
      });

      await deps.safeUpdateRun(run.id, {
        status: progress.failedSymbols.length === symbols.length ? 'FAILED' : 'COMPLETED',
        finishedAt: new Date(),
        seedConfig: {
          ...seed,
          liveProgress: {
            ...progress,
            currentSymbol: null,
            lastUpdate: 'completed',
            updatedAt: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      await deps.safeUpdateRun(run.id, {
        status: 'FAILED',
        finishedAt: new Date(),
        seedConfig: {
          ...seed,
          liveProgress: {
            ...progress,
            lastUpdate: 'failed',
            updatedAt: new Date().toISOString(),
          },
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  };
