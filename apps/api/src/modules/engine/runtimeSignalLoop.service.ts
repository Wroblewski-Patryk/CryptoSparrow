import { SignalDirection } from '@prisma/client';
import { metricsStore } from '../../observability/metrics';
import {
  MarketStreamEvent,
  StreamCandleEvent,
  StreamTickerEvent,
} from '../market-stream/binanceStream.types';
import { subscribeMarketStreamEvents } from '../market-stream/marketStreamFanout';
import { analyzePreTrade } from './preTrade.service';
import { orchestrateRuntimeSignal } from './executionOrchestrator.service';
import { runtimePositionAutomationService } from './runtimePositionAutomation.service';
import { getRuntimeTicker, upsertRuntimeTicker } from './runtimeTickerStore';
import { RuntimeSignalDecisionEngine } from './runtimeSignalDecisionEngine';
import {
  evaluateStrategySignalAtIndex,
  parseStrategySignalRules,
} from './strategySignalEvaluator';
import {
  computeAdxSeriesFromCandles,
  computeAtrSeriesFromCandles,
  computeBollingerSeriesFromCloses,
  computeCciSeriesFromCandles,
  computeDonchianSeriesFromCandles,
  clampPeriod,
  computeEmaSeriesFromCloses,
  computeMacdSeriesFromCloses,
  computeMomentumSeriesFromCloses,
  computeRollingZScoreSeriesFromNullableValues,
  computeRocSeriesFromCloses,
  computeRsiSeriesFromCloses,
  computeSmaSeriesFromNullableValues,
  computeSmaSeriesFromCloses,
  computeStochasticSeriesFromCandles,
  computeStochRsiSeriesFromCloses,
} from './sharedIndicatorSeries';
import {
  alignTimedNumericPointsToCandles,
  normalizeTimedNumericPoints,
} from './sharedDerivativesSeries';
import {
  CandlePatternParams,
  computeCandlePatternSeries,
  resolveCandlePatternName,
} from './sharedCandlePatternSeries';
import { resolveRuntimeDcaFundsExhausted, resolveRuntimeReferenceBalance } from './runtimeCapitalContext.service';
import { runtimeTelemetryService } from './runtimeTelemetry.service';
import { mergeRuntimeStrategyVotes, StrategyVote } from './runtimeSignalMerge';
import {
  RuntimeSignalConditionLine,
  StrategyEvaluation,
} from './runtimeSignalEvaluationTypes';
import {
  FundingRatePoint,
  OpenInterestPoint,
  OrderBookPoint,
} from './runtimeSignalSeriesTypes';
import {
  ActiveBot,
  ActiveBotStrategy,
  deriveRuntimeGroupMaxOpenPositions,
  normalizeInterval,
  formatIndicatorValue,
  formatRuleTarget,
  resolvePatternParams,
  resolveRuntimeOrderQuantity,
  supportsRuntimeSignalLoopExchange,
  listActiveRuntimeBots,
  listRuntimeManagedExternalPositions,
  countOpenPositionsForBotAndSymbols,
  createRuntimeSignal,
} from './runtimeSignalLoopDefaults';

export {
  deriveRuntimeGroupMaxOpenPositions,
  supportsRuntimeSignalLoopExchange,
} from './runtimeSignalLoopDefaults';

type RuntimeSignalLoopDeps = {
  subscribe: (
    handler: (event: MarketStreamEvent) => void | Promise<void>
  ) => Promise<() => Promise<void>>;
  listActiveBots: () => Promise<ActiveBot[]>;
  listRuntimeManagedExternalPositions: () => Promise<Array<{ userId: string; symbol: string }>>;
  countOpenPositionsForBotAndSymbols: (params: {
    userId: string;
    botId: string;
    symbols: string[];
  }) => Promise<number>;
  createSignal: (params: {
    userId: string;
    botId?: string;
    strategyId?: string;
    symbol: string;
    direction: SignalDirection;
    confidence: number;
    payload: Record<string, unknown>;
  }) => Promise<void>;
  analyzePreTradeFn: typeof analyzePreTrade;
  orchestrateFn: typeof orchestrateRuntimeSignal;
  processPositionAutomation: (event: StreamTickerEvent) => Promise<void>;
  nowMs: () => number;
  ensureRuntimeSession?: (params: {
    userId: string;
    botId: string;
    mode: 'PAPER' | 'LIVE';
  }) => Promise<string>;
  closeRuntimeSession?: (params: {
    botId: string;
    status: 'COMPLETED' | 'FAILED' | 'CANCELED';
    stopReason?: string;
    errorMessage?: string;
  }) => Promise<void>;
  closeInactiveRuntimeSessions?: (activeBotIds: string[]) => Promise<void>;
  recordRuntimeEvent?: (params: {
    userId: string;
    botId: string;
    mode?: 'PAPER' | 'LIVE';
    sessionId?: string;
    eventType:
      | 'SESSION_STARTED'
      | 'SESSION_STOPPED'
      | 'HEARTBEAT'
      | 'SIGNAL_DECISION'
      | 'PRETRADE_BLOCKED'
      | 'ORDER_SUBMITTED'
      | 'ORDER_FILLED'
      | 'POSITION_OPENED'
      | 'POSITION_CLOSED'
      | 'DCA_EXECUTED'
      | 'ERROR';
    level?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    symbol?: string;
    botMarketGroupId?: string;
    strategyId?: string;
    signalDirection?: SignalDirection;
    message?: string;
    payload?: Record<string, unknown>;
    eventAt?: Date;
  }) => Promise<void>;
  upsertRuntimeSymbolStat?: (params: {
    userId: string;
    botId: string;
    mode?: 'PAPER' | 'LIVE';
    sessionId?: string;
    symbol: string;
    increments?: {
      totalSignals?: number;
      longEntries?: number;
      shortEntries?: number;
      exits?: number;
      dcaCount?: number;
      closedTrades?: number;
      winningTrades?: number;
      losingTrades?: number;
      realizedPnl?: number;
      grossProfit?: number;
      grossLoss?: number;
      feesPaid?: number;
    };
    lastPrice?: number;
    lastSignalAt?: Date;
    lastTradeAt?: Date;
    openPositionCount?: number;
    openPositionQty?: number;
  }) => Promise<void>;
  stallDetectorEnabled?: boolean;
  stallNoEventMs?: number;
  stallNoHeartbeatMs?: number;
  autoRestartEnabled?: boolean;
  autoRestartCooldownMs?: number;
  autoRestartMaxAttempts?: number;
  autoRestartWindowMs?: number;
};

const runtimeSignalQuantity = Number.parseFloat(process.env.RUNTIME_SIGNAL_QUANTITY ?? '0.01');
const runtimeSignalDecisionDedupeRetentionMs = Number.parseInt(
  process.env.RUNTIME_SIGNAL_DEDUPE_RETENTION_MS ?? '21600000',
  10
);
const maxCandlesPerSeries = Number.parseInt(process.env.RUNTIME_SIGNAL_CANDLE_BUFFER ?? '500', 10);
const minDirectionalScore = Number.parseFloat(process.env.RUNTIME_SIGNAL_MIN_DIRECTIONAL_SCORE ?? '1');
const runtimeSignalWarmupEnabled = process.env.RUNTIME_SIGNAL_WARMUP_ENABLED !== 'false';
const runtimeSignalWarmupCandles = Math.max(
  20,
  Number.parseInt(process.env.RUNTIME_SIGNAL_WARMUP_CANDLES ?? '150', 10)
);
const runtimeSignalWarmupRetryMs = Math.max(
  60_000,
  Number.parseInt(process.env.RUNTIME_SIGNAL_WARMUP_RETRY_MS ?? '300000', 10)
);
const tickerFreshnessFallbackMs = Math.max(
  30_000,
  Number.parseInt(process.env.RUNTIME_SIGNAL_TICKER_FRESHNESS_MS ?? '90000', 10)
);
const runtimeSessionWatchdogIntervalMs = Math.max(
  5_000,
  Number.parseInt(process.env.RUNTIME_SESSION_WATCHDOG_INTERVAL_MS ?? '15000', 10)
);
const runtimeStallDetectorEnabled = process.env.RUNTIME_STALL_DETECTOR_ENABLED !== 'false';
const runtimeStallNoEventMs = Math.max(
  60_000,
  Number.parseInt(process.env.RUNTIME_STALL_NO_EVENT_MS ?? '300000', 10)
);
const runtimeStallNoHeartbeatMs = Math.max(
  runtimeSessionWatchdogIntervalMs * 2,
  Number.parseInt(process.env.RUNTIME_STALL_NO_HEARTBEAT_MS ?? '60000', 10)
);
const runtimeAutoRestartEnabled = process.env.RUNTIME_AUTO_RESTART_ENABLED !== 'false';
const runtimeAutoRestartCooldownMs = Math.max(
  5_000,
  Number.parseInt(process.env.RUNTIME_AUTO_RESTART_COOLDOWN_MS ?? '30000', 10)
);
const runtimeAutoRestartMaxAttempts = Math.max(
  1,
  Number.parseInt(process.env.RUNTIME_AUTO_RESTART_MAX_ATTEMPTS ?? '5', 10)
);
const runtimeAutoRestartWindowMs = Math.max(
  runtimeAutoRestartCooldownMs,
  Number.parseInt(process.env.RUNTIME_AUTO_RESTART_WINDOW_MS ?? '300000', 10)
);
const runtimeFundingRefreshMs = Math.max(
  30_000,
  Number.parseInt(process.env.RUNTIME_FUNDING_REFRESH_MS ?? '180000', 10),
);
const runtimeFundingHistoryLimit = Math.max(
  20,
  Number.parseInt(process.env.RUNTIME_FUNDING_HISTORY_LIMIT ?? '200', 10),
);
const runtimeOpenInterestRefreshMs = Math.max(
  30_000,
  Number.parseInt(process.env.RUNTIME_OPEN_INTEREST_REFRESH_MS ?? '180000', 10),
);
const runtimeOpenInterestHistoryLimit = Math.max(
  20,
  Number.parseInt(process.env.RUNTIME_OPEN_INTEREST_HISTORY_LIMIT ?? '200', 10),
);
const runtimeOrderBookRefreshMs = Math.max(
  10_000,
  Number.parseInt(process.env.RUNTIME_ORDER_BOOK_REFRESH_MS ?? '60000', 10),
);

type RuntimeCandle = {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const defaultDeps: RuntimeSignalLoopDeps = {
  subscribe: subscribeMarketStreamEvents,
  listActiveBots: listActiveRuntimeBots,
  listRuntimeManagedExternalPositions,
  countOpenPositionsForBotAndSymbols,
  createSignal: createRuntimeSignal,
  analyzePreTradeFn: analyzePreTrade,
  orchestrateFn: orchestrateRuntimeSignal,
  processPositionAutomation: (event) => runtimePositionAutomationService.handleTickerEvent(event),
  nowMs: () => Date.now(),
  ensureRuntimeSession: (params) => runtimeTelemetryService.ensureRuntimeSession(params),
  closeRuntimeSession: (params) => runtimeTelemetryService.closeRuntimeSession(params),
  closeInactiveRuntimeSessions: (activeBotIds) =>
    runtimeTelemetryService.closeInactiveRuntimeSessions(activeBotIds),
  recordRuntimeEvent: (params) => runtimeTelemetryService.recordRuntimeEvent(params),
  upsertRuntimeSymbolStat: (params) => runtimeTelemetryService.upsertRuntimeSymbolStat(params),
};

export class RuntimeSignalLoop {
  private unsubscribe: (() => Promise<void>) | null = null;
  private sessionWatchdogTimer: NodeJS.Timeout | null = null;
  private autoRestartTimer: NodeJS.Timeout | null = null;
  private readonly autoRestartAttempts: number[] = [];
  private readonly processedDecisionWindows = new Map<string, number>();
  private readonly candleSeries = new Map<string, RuntimeCandle[]>();
  private readonly warmupLastAttemptAt = new Map<string, number>();
  private readonly fundingRatePoints = new Map<string, FundingRatePoint[]>();
  private readonly fundingLastFetchAt = new Map<string, number>();
  private readonly openInterestPoints = new Map<string, OpenInterestPoint[]>();
  private readonly openInterestLastFetchAt = new Map<string, number>();
  private readonly orderBookPoints = new Map<string, OrderBookPoint[]>();
  private readonly orderBookLastFetchAt = new Map<string, number>();
  private lastStreamEventAtMs: number | null = null;
  private lastSessionSyncSuccessAtMs: number | null = null;
  private lastKnownActiveBotIds = new Set<string>();

  private readonly decisionEngine = new RuntimeSignalDecisionEngine({
    getSeries: (marketType, symbol, interval) => this.getSeries(marketType, symbol, interval),
    resolveFundingRateSeriesForCandles: (marketType, symbol, candles) =>
      this.resolveFundingRateSeriesForCandles(marketType, symbol, candles),
    resolveOpenInterestSeriesForCandles: (marketType, symbol, candles) =>
      this.resolveOpenInterestSeriesForCandles(marketType, symbol, candles),
    resolveOrderBookSeriesForCandles: (marketType, symbol, candles) =>
      this.resolveOrderBookSeriesForCandles(marketType, symbol, candles),
  });

  constructor(private readonly deps: RuntimeSignalLoopDeps = defaultDeps) {}

  isRunning() {
    return this.unsubscribe !== null;
  }

  async start() {
    if (this.unsubscribe) return;
    if (this.autoRestartTimer) {
      clearTimeout(this.autoRestartTimer);
      this.autoRestartTimer = null;
    }
    const activeBots = await this.syncRuntimeSessions();
    const now = Date.now();
    this.lastSessionSyncSuccessAtMs = now;
    this.lastStreamEventAtMs = now;
    this.lastKnownActiveBotIds = new Set(activeBots.map((bot) => bot.id));
    this.unsubscribe = await this.deps.subscribe(async (event) => {
      try {
        await this.handleEvent(event);
      } catch (error) {
        console.error('RuntimeSignalLoop event handler failed:', error);
        metricsStore.recordRuntimeExecutionError('runtime_event_handler_failure');
      }
    });
    this.startSessionWatchdog();
  }

  async stop() {
    this.clearAutoRestartState();
    if (this.sessionWatchdogTimer) {
      clearInterval(this.sessionWatchdogTimer);
      this.sessionWatchdogTimer = null;
    }
    if (!this.unsubscribe) return;
    const activeBots = await this.deps.listActiveBots();
    await Promise.all(
      activeBots.map((bot) =>
        this.deps.closeRuntimeSession?.({
          botId: bot.id,
          status: 'CANCELED',
          stopReason: 'signal_loop_stopped',
        })
      )
    );
    await this.unsubscribe();
    this.unsubscribe = null;
    this.lastStreamEventAtMs = null;
    this.lastSessionSyncSuccessAtMs = null;
    this.lastKnownActiveBotIds.clear();
  }

  private startSessionWatchdog() {
    if (this.sessionWatchdogTimer) return;
    if (!Number.isFinite(runtimeSessionWatchdogIntervalMs) || runtimeSessionWatchdogIntervalMs <= 0) return;

    this.sessionWatchdogTimer = setInterval(() => {
      void (async () => {
        const now = Date.now();
        let activeBots: ActiveBot[] = [];
        try {
          activeBots = await this.syncRuntimeSessions();
          this.lastSessionSyncSuccessAtMs = now;
          this.lastKnownActiveBotIds = new Set(activeBots.map((bot) => bot.id));
        } catch (error) {
          console.error('RuntimeSignalLoop session watchdog failed:', error);
          metricsStore.recordRuntimeExecutionError('runtime_watchdog_sync_failure');
        }
        await this.detectRuntimeStall(now, activeBots.map((bot) => bot.id));
      })();
    }, runtimeSessionWatchdogIntervalMs);
    this.sessionWatchdogTimer.unref?.();
  }

  private async syncRuntimeSessions() {
    const activeBots = await this.deps.listActiveBots();
    await this.deps.closeInactiveRuntimeSessions?.(activeBots.map((bot) => bot.id));
    await Promise.all(
      activeBots.map((bot) =>
        this.deps.ensureRuntimeSession?.({
          userId: bot.userId,
          botId: bot.id,
          mode: bot.mode,
        })
      )
    );
    return activeBots;
  }

  private async detectRuntimeStall(now: number, activeBotIdsFromSync: string[]) {
    if (!this.isStallDetectorEnabled() || !this.unsubscribe) return;
    const activeBotIds =
      activeBotIdsFromSync.length > 0
        ? activeBotIdsFromSync
        : Array.from(this.lastKnownActiveBotIds.values());
    if (activeBotIds.length === 0) return;

    if (
      this.lastSessionSyncSuccessAtMs != null &&
      now - this.lastSessionSyncSuccessAtMs > this.resolveStallNoHeartbeatMs()
    ) {
      await this.handleRuntimeStall('runtime_stall_no_heartbeat', activeBotIds);
      return;
    }

    if (this.lastStreamEventAtMs != null && now - this.lastStreamEventAtMs > this.resolveStallNoEventMs()) {
      await this.handleRuntimeStall('runtime_stall_no_event', activeBotIds);
    }
  }

  private async handleRuntimeStall(
    reason: 'runtime_stall_no_event' | 'runtime_stall_no_heartbeat',
    activeBotIds: string[]
  ) {
    if (!this.unsubscribe) return;
    console.error(`RuntimeSignalLoop stall detected: ${reason}. Restart requested.`);
    metricsStore.recordRuntimeRestart(reason);
    if (reason === 'runtime_stall_no_heartbeat') {
      await Promise.all(
        activeBotIds.map((botId) =>
          this.deps.closeRuntimeSession?.({
            botId,
            status: 'CANCELED',
            stopReason: reason,
          })
        )
      );
    }
    await this.unsubscribe();
    this.unsubscribe = null;
    if (this.sessionWatchdogTimer) {
      clearInterval(this.sessionWatchdogTimer);
      this.sessionWatchdogTimer = null;
    }
    this.processedDecisionWindows.clear();
    this.lastStreamEventAtMs = null;
    this.lastSessionSyncSuccessAtMs = null;
    this.lastKnownActiveBotIds.clear();
    this.scheduleAutoRestart(reason);
  }

  private isStallDetectorEnabled() {
    if (typeof this.deps.stallDetectorEnabled === 'boolean') return this.deps.stallDetectorEnabled;
    return runtimeStallDetectorEnabled;
  }

  private resolveStallNoEventMs() {
    if (Number.isFinite(this.deps.stallNoEventMs as number)) {
      return Math.max(10_000, this.deps.stallNoEventMs as number);
    }
    return runtimeStallNoEventMs;
  }

  private resolveStallNoHeartbeatMs() {
    if (Number.isFinite(this.deps.stallNoHeartbeatMs as number)) {
      return Math.max(10_000, this.deps.stallNoHeartbeatMs as number);
    }
    return runtimeStallNoHeartbeatMs;
  }

  private clearAutoRestartState() {
    if (this.autoRestartTimer) {
      clearTimeout(this.autoRestartTimer);
      this.autoRestartTimer = null;
    }
    this.autoRestartAttempts.length = 0;
  }

  private resolveAutoRestartEnabled() {
    if (typeof this.deps.autoRestartEnabled === 'boolean') return this.deps.autoRestartEnabled;
    return runtimeAutoRestartEnabled;
  }

  private resolveAutoRestartCooldownMs() {
    if (Number.isFinite(this.deps.autoRestartCooldownMs as number)) {
      return Math.max(1_000, this.deps.autoRestartCooldownMs as number);
    }
    return runtimeAutoRestartCooldownMs;
  }

  private resolveAutoRestartMaxAttempts() {
    if (Number.isFinite(this.deps.autoRestartMaxAttempts as number)) {
      return Math.max(1, Math.floor(this.deps.autoRestartMaxAttempts as number));
    }
    return runtimeAutoRestartMaxAttempts;
  }

  private resolveAutoRestartWindowMs() {
    const minWindow = this.resolveAutoRestartCooldownMs();
    if (Number.isFinite(this.deps.autoRestartWindowMs as number)) {
      return Math.max(minWindow, this.deps.autoRestartWindowMs as number);
    }
    return Math.max(minWindow, runtimeAutoRestartWindowMs);
  }

  private pruneAutoRestartAttempts(now: number) {
    const windowMs = this.resolveAutoRestartWindowMs();
    for (let index = this.autoRestartAttempts.length - 1; index >= 0; index -= 1) {
      if (now - this.autoRestartAttempts[index] > windowMs) {
        this.autoRestartAttempts.splice(index, 1);
      }
    }
  }

  private scheduleAutoRestart(reason: 'runtime_stall_no_event' | 'runtime_stall_no_heartbeat') {
    if (!this.resolveAutoRestartEnabled()) return;
    if (this.unsubscribe) return;
    if (this.autoRestartTimer) return;
    const delayMs = this.resolveAutoRestartCooldownMs();
    this.autoRestartTimer = setTimeout(() => {
      this.autoRestartTimer = null;
      void this.performAutoRestart(reason);
    }, delayMs);
    this.autoRestartTimer.unref?.();
  }

  private async performAutoRestart(reason: 'runtime_stall_no_event' | 'runtime_stall_no_heartbeat') {
    if (!this.resolveAutoRestartEnabled()) return;
    if (this.unsubscribe) return;
    const now = Date.now();
    this.pruneAutoRestartAttempts(now);
    if (this.autoRestartAttempts.length >= this.resolveAutoRestartMaxAttempts()) {
      metricsStore.recordRuntimeExecutionError('runtime_restart_guard_max_attempts');
      this.scheduleAutoRestart(reason);
      return;
    }

    this.autoRestartAttempts.push(now);
    try {
      await this.start();
    } catch (error) {
      console.error(`RuntimeSignalLoop auto-restart failed after ${reason}:`, error);
      metricsStore.recordRuntimeExecutionError('runtime_auto_restart_failure');
      this.scheduleAutoRestart(reason);
    }
  }

  async processTickerEvent(event: StreamTickerEvent) {
    await this.handleTickerEvent(event);
  }

  async processCandleEvent(event: StreamCandleEvent) {
    await this.handleCandleEvent(event);
  }

  private async handleEvent(event: MarketStreamEvent) {
    const now = Date.now();
    this.lastStreamEventAtMs = now;
    metricsStore.recordRuntimeSignalLag(now - event.eventTime);
    if (event.type === 'candle') {
      await this.handleCandleEvent(event);
      return;
    }
    if (event.type === 'ticker') {
      await this.handleTickerEvent(event);
    }
  }

  private async handleCandleEvent(event: StreamCandleEvent) {
    if (!event.isFinal) return;
    const key = this.getSeriesKey(event.marketType, event.symbol, event.interval);
    const series = this.candleSeries.get(key) ?? [];
    const nextCandle = {
      openTime: event.openTime,
      closeTime: event.closeTime,
      open: event.open,
      high: event.high,
      low: event.low,
      close: event.close,
      volume: event.volume,
    };
    const previousIndex = series.findIndex((candle) => candle.openTime === event.openTime);
    if (previousIndex >= 0) {
      series[previousIndex] = nextCandle;
    } else {
      series.push(nextCandle);
    }
    series.sort((a, b) => a.openTime - b.openTime);
    if (series.length > maxCandlesPerSeries) {
      series.splice(0, series.length - maxCandlesPerSeries);
    }
    this.candleSeries.set(key, series);
    await this.ensureSeriesWarmup(event.marketType, event.symbol, event.interval, event.closeTime);
    await this.ensureFundingRateSeriesForCandle(event);
    await this.ensureOpenInterestSeriesForCandle(event);
    await this.ensureOrderBookSeriesForCandle(event);
    await this.processPositionAutomationFallbackFromCandle(event);
    await this.handleFinalCandleDecision(event);
  }

  private warmupUrl(
    marketType: 'FUTURES' | 'SPOT',
    symbol: string,
    interval: string,
    limit: number,
    endTimeMs?: number
  ) {
    const base =
      marketType === 'SPOT'
        ? process.env.BINANCE_SPOT_REST_URL ?? 'https://api.binance.com'
        : process.env.BINANCE_FUTURES_REST_URL ?? 'https://fapi.binance.com';
    const endpoint = marketType === 'SPOT' ? '/api/v3/klines' : '/fapi/v1/klines';
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      interval: normalizeInterval(interval),
      limit: String(Math.min(1000, Math.max(20, limit))),
    });
    if (Number.isFinite(endTimeMs)) {
      params.set('endTime', String(Math.floor(endTimeMs as number)));
    }
    return `${base}${endpoint}?${params.toString()}`;
  }

  private async fetchWarmupCandles(
    marketType: 'FUTURES' | 'SPOT',
    symbol: string,
    interval: string,
    limit: number,
    endTimeMs?: number
  ): Promise<RuntimeCandle[]> {
    if (process.env.NODE_ENV === 'test') return [];
    const url = this.warmupUrl(marketType, symbol, interval, limit, endTimeMs);
    try {
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) return [];
      const payload = (await response.json()) as unknown;
      if (!Array.isArray(payload)) return [];
      const now = Date.now();
      const closeTimeCutoff = Number.isFinite(endTimeMs)
        ? Math.floor(endTimeMs as number)
        : now;
      return payload
        .map((item) => {
          if (!Array.isArray(item)) return null;
          const openTime = Number(item[0]);
          const open = Number(item[1]);
          const high = Number(item[2]);
          const low = Number(item[3]);
          const close = Number(item[4]);
          const volume = Number(item[5]);
          const closeTime = Number(item[6]);
          if (!Number.isFinite(openTime) || !Number.isFinite(closeTime)) return null;
          if (
            !Number.isFinite(open) ||
            !Number.isFinite(high) ||
            !Number.isFinite(low) ||
            !Number.isFinite(close) ||
            !Number.isFinite(volume)
          ) {
            return null;
          }
          if (Number.isFinite(closeTime) && closeTime > closeTimeCutoff) return null;
          return {
            openTime,
            closeTime,
            open,
            high,
            low,
            close,
            volume,
          } satisfies RuntimeCandle;
        })
        .filter((item): item is RuntimeCandle => Boolean(item))
        .sort((left, right) => left.openTime - right.openTime);
    } catch {
      return [];
    }
  }

  private async ensureSeriesWarmup(
    marketType: 'FUTURES' | 'SPOT',
    symbol: string,
    interval: string,
    endTimeMs?: number
  ) {
    if (!runtimeSignalWarmupEnabled) return;
    const normalizedInterval = normalizeInterval(interval);
    const key = this.getSeriesKey(marketType, symbol, normalizedInterval);
    const currentSeries = this.candleSeries.get(key) ?? [];
    if (currentSeries.length >= runtimeSignalWarmupCandles) return;

    const now = this.deps.nowMs();
    const lastAttemptAt = this.warmupLastAttemptAt.get(key) ?? 0;
    if (now - lastAttemptAt < runtimeSignalWarmupRetryMs) return;
    this.warmupLastAttemptAt.set(key, now);

    const fetched = await this.fetchWarmupCandles(
      marketType,
      symbol,
      normalizedInterval,
      runtimeSignalWarmupCandles,
      endTimeMs
    );
    if (fetched.length === 0) return;

    const deduped = new Map<number, RuntimeCandle>();
    for (const candle of fetched) deduped.set(candle.openTime, candle);
    for (const candle of currentSeries) deduped.set(candle.openTime, candle);

    const merged = [...deduped.values()].sort((left, right) => left.openTime - right.openTime);
    if (merged.length > maxCandlesPerSeries) {
      merged.splice(0, merged.length - maxCandlesPerSeries);
    }
    this.candleSeries.set(key, merged);
  }

  private getFundingKey(marketType: 'FUTURES' | 'SPOT', symbol: string) {
    return `${marketType}|${symbol.toUpperCase()}`;
  }

  private mergeFundingRatePoints(
    key: string,
    incoming: FundingRatePoint[],
  ) {
    if (incoming.length === 0) return;
    const existing = this.fundingRatePoints.get(key) ?? [];
    const normalized = normalizeTimedNumericPoints(
      [...existing, ...incoming].map((point) => ({
        timestamp: point.timestamp,
        value: point.fundingRate,
      })),
    ).map((point) => ({
      timestamp: point.timestamp,
      fundingRate: point.value,
    }));

    if (normalized.length > maxCandlesPerSeries) {
      normalized.splice(0, normalized.length - maxCandlesPerSeries);
    }
    this.fundingRatePoints.set(key, normalized);
  }

  private async fetchFundingRateHistory(
    symbol: string,
    endTimeMs?: number,
  ): Promise<FundingRatePoint[]> {
    if (process.env.NODE_ENV === 'test') return [];
    const base = process.env.BINANCE_FUTURES_REST_URL ?? 'https://fapi.binance.com';
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      limit: String(Math.min(1000, Math.max(20, runtimeFundingHistoryLimit))),
    });
    if (Number.isFinite(endTimeMs)) {
      params.set('endTime', String(Math.floor(endTimeMs as number)));
    }
    const url = `${base}/fapi/v1/fundingRate?${params.toString()}`;

    try {
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) return [];
      const payload = (await response.json()) as unknown;
      if (!Array.isArray(payload)) return [];
      return payload
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const row = item as { fundingTime?: unknown; fundingRate?: unknown };
          const timestamp = Number(row.fundingTime);
          const fundingRate = Number(row.fundingRate);
          if (!Number.isFinite(timestamp) || !Number.isFinite(fundingRate)) return null;
          return { timestamp, fundingRate } satisfies FundingRatePoint;
        })
        .filter((item): item is FundingRatePoint => Boolean(item))
        .sort((left, right) => left.timestamp - right.timestamp);
    } catch {
      return [];
    }
  }

  private async fetchFundingRateSnapshot(
    symbol: string,
  ): Promise<FundingRatePoint | null> {
    if (process.env.NODE_ENV === 'test') return null;
    const base = process.env.BINANCE_FUTURES_REST_URL ?? 'https://fapi.binance.com';
    const params = new URLSearchParams({ symbol: symbol.toUpperCase() });
    const url = `${base}/fapi/v1/premiumIndex?${params.toString()}`;

    try {
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) return null;
      const payload = (await response.json()) as unknown;
      if (!payload || typeof payload !== 'object') return null;
      const row = payload as { time?: unknown; lastFundingRate?: unknown };
      const timestamp = Number(row.time);
      const fundingRate = Number(row.lastFundingRate);
      if (!Number.isFinite(timestamp) || !Number.isFinite(fundingRate)) return null;
      return { timestamp, fundingRate } satisfies FundingRatePoint;
    } catch {
      return null;
    }
  }

  private async ensureFundingRateSeriesForCandle(event: StreamCandleEvent) {
    if (event.marketType !== 'FUTURES') return;
    const key = this.getFundingKey(event.marketType, event.symbol);
    const now = this.deps.nowMs();
    const existing = this.fundingRatePoints.get(key) ?? [];
    const lastFetchAt = this.fundingLastFetchAt.get(key) ?? 0;
    const shouldRefresh =
      existing.length === 0 || now - lastFetchAt >= runtimeFundingRefreshMs;
    if (!shouldRefresh) return;

    const incoming: FundingRatePoint[] = [];
    if (existing.length === 0) {
      incoming.push(
        ...(await this.fetchFundingRateHistory(event.symbol, event.closeTime)),
      );
    }
    const snapshot = await this.fetchFundingRateSnapshot(event.symbol);
    if (snapshot) incoming.push(snapshot);
    this.mergeFundingRatePoints(key, incoming);
    this.fundingLastFetchAt.set(key, now);
  }

  private resolveFundingRateSeriesForCandles(
    marketType: 'FUTURES' | 'SPOT',
    symbol: string,
    candles: RuntimeCandle[],
  ): Array<number | null> | null {
    if (marketType !== 'FUTURES') return null;
    const key = this.getFundingKey(marketType, symbol);
    const points = this.fundingRatePoints.get(key) ?? [];
    if (points.length === 0) return null;
    return alignTimedNumericPointsToCandles(
      candles,
      points.map((point) => ({
        timestamp: point.timestamp,
        value: point.fundingRate,
      })),
    );
  }

  private mergeOpenInterestPoints(
    key: string,
    incoming: OpenInterestPoint[],
  ) {
    if (incoming.length === 0) return;
    const existing = this.openInterestPoints.get(key) ?? [];
    const normalized = normalizeTimedNumericPoints(
      [...existing, ...incoming].map((point) => ({
        timestamp: point.timestamp,
        value: point.openInterest,
      })),
    ).map((point) => ({
      timestamp: point.timestamp,
      openInterest: point.value,
    }));

    if (normalized.length > maxCandlesPerSeries) {
      normalized.splice(0, normalized.length - maxCandlesPerSeries);
    }
    this.openInterestPoints.set(key, normalized);
  }

  private openInterestPeriodForInterval(interval: string) {
    const normalized = normalizeInterval(interval);
    const supported = new Set(['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d']);
    if (supported.has(normalized)) return normalized;
    return '5m';
  }

  private async fetchOpenInterestHistory(
    symbol: string,
    interval: string,
    endTimeMs?: number,
  ): Promise<OpenInterestPoint[]> {
    if (process.env.NODE_ENV === 'test') return [];
    const base = process.env.BINANCE_FUTURES_REST_URL ?? 'https://fapi.binance.com';
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      period: this.openInterestPeriodForInterval(interval),
      limit: String(Math.min(500, Math.max(20, runtimeOpenInterestHistoryLimit))),
    });
    if (Number.isFinite(endTimeMs)) {
      params.set('endTime', String(Math.floor(endTimeMs as number)));
    }
    const url = `${base}/futures/data/openInterestHist?${params.toString()}`;

    try {
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) return [];
      const payload = (await response.json()) as unknown;
      if (!Array.isArray(payload)) return [];
      return payload
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const row = item as { timestamp?: unknown; sumOpenInterest?: unknown };
          const timestamp = Number(row.timestamp);
          const openInterest = Number(row.sumOpenInterest);
          if (!Number.isFinite(timestamp) || !Number.isFinite(openInterest)) return null;
          return { timestamp, openInterest } satisfies OpenInterestPoint;
        })
        .filter((item): item is OpenInterestPoint => Boolean(item))
        .sort((left, right) => left.timestamp - right.timestamp);
    } catch {
      return [];
    }
  }

  private async fetchOpenInterestSnapshot(
    symbol: string,
  ): Promise<OpenInterestPoint | null> {
    if (process.env.NODE_ENV === 'test') return null;
    const base = process.env.BINANCE_FUTURES_REST_URL ?? 'https://fapi.binance.com';
    const params = new URLSearchParams({ symbol: symbol.toUpperCase() });
    const url = `${base}/fapi/v1/openInterest?${params.toString()}`;

    try {
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) return null;
      const payload = (await response.json()) as unknown;
      if (!payload || typeof payload !== 'object') return null;
      const row = payload as { time?: unknown; openInterest?: unknown };
      const timestamp = Number(row.time);
      const openInterest = Number(row.openInterest);
      if (!Number.isFinite(timestamp) || !Number.isFinite(openInterest)) return null;
      return { timestamp, openInterest } satisfies OpenInterestPoint;
    } catch {
      return null;
    }
  }

  private async ensureOpenInterestSeriesForCandle(event: StreamCandleEvent) {
    if (event.marketType !== 'FUTURES') return;
    const key = this.getFundingKey(event.marketType, event.symbol);
    const now = this.deps.nowMs();
    const existing = this.openInterestPoints.get(key) ?? [];
    const lastFetchAt = this.openInterestLastFetchAt.get(key) ?? 0;
    const shouldRefresh =
      existing.length === 0 || now - lastFetchAt >= runtimeOpenInterestRefreshMs;
    if (!shouldRefresh) return;

    const incoming: OpenInterestPoint[] = [];
    if (existing.length === 0) {
      incoming.push(
        ...(await this.fetchOpenInterestHistory(
          event.symbol,
          event.interval,
          event.closeTime,
        )),
      );
    }
    const snapshot = await this.fetchOpenInterestSnapshot(event.symbol);
    if (snapshot) incoming.push(snapshot);
    this.mergeOpenInterestPoints(key, incoming);
    this.openInterestLastFetchAt.set(key, now);
  }

  private resolveOpenInterestSeriesForCandles(
    marketType: 'FUTURES' | 'SPOT',
    symbol: string,
    candles: RuntimeCandle[],
  ): Array<number | null> | null {
    if (marketType !== 'FUTURES') return null;
    const key = this.getFundingKey(marketType, symbol);
    const points = this.openInterestPoints.get(key) ?? [];
    if (points.length === 0) return null;
    return alignTimedNumericPointsToCandles(
      candles,
      points.map((point) => ({
        timestamp: point.timestamp,
        value: point.openInterest,
      })),
    );
  }

  private mergeOrderBookPoints(
    key: string,
    incoming: OrderBookPoint[],
  ) {
    if (incoming.length === 0) return;
    const merged = new Map<number, OrderBookPoint>();
    for (const point of this.orderBookPoints.get(key) ?? []) {
      merged.set(point.timestamp, point);
    }
    for (const point of incoming) {
      if (
        !Number.isFinite(point.timestamp) ||
        !Number.isFinite(point.imbalance) ||
        !Number.isFinite(point.spreadBps) ||
        !Number.isFinite(point.depthRatio)
      ) {
        continue;
      }
      merged.set(point.timestamp, point);
    }

    const normalized = [...merged.values()].sort((left, right) => left.timestamp - right.timestamp);
    if (normalized.length > maxCandlesPerSeries) {
      normalized.splice(0, normalized.length - maxCandlesPerSeries);
    }
    this.orderBookPoints.set(key, normalized);
  }

  private async fetchOrderBookSnapshot(
    symbol: string,
  ): Promise<OrderBookPoint | null> {
    if (process.env.NODE_ENV === 'test') return null;
    const base = process.env.BINANCE_FUTURES_REST_URL ?? 'https://fapi.binance.com';
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      limit: '100',
    });
    const url = `${base}/fapi/v1/depth?${params.toString()}`;

    try {
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) return null;
      const payload = (await response.json()) as unknown;
      if (!payload || typeof payload !== 'object') return null;
      const row = payload as {
        bids?: unknown;
        asks?: unknown;
        E?: unknown;
        T?: unknown;
      };

      const bids = Array.isArray(row.bids) ? row.bids : [];
      const asks = Array.isArray(row.asks) ? row.asks : [];
      if (bids.length === 0 || asks.length === 0) return null;

      const parseBookRow = (item: unknown) => {
        if (!Array.isArray(item) || item.length < 2) return null;
        const price = Number(item[0]);
        const amount = Number(item[1]);
        if (!Number.isFinite(price) || !Number.isFinite(amount) || price <= 0 || amount < 0) {
          return null;
        }
        return { price, amount };
      };

      const parsedBids = bids
        .map(parseBookRow)
        .filter((item): item is { price: number; amount: number } => Boolean(item));
      const parsedAsks = asks
        .map(parseBookRow)
        .filter((item): item is { price: number; amount: number } => Boolean(item));
      if (parsedBids.length === 0 || parsedAsks.length === 0) return null;

      const bidDepth = parsedBids.reduce((sum, item) => sum + item.amount, 0);
      const askDepth = parsedAsks.reduce((sum, item) => sum + item.amount, 0);
      const bestBid = parsedBids[0].price;
      const bestAsk = parsedAsks[0].price;
      const mid = (bestBid + bestAsk) / 2;
      const spreadBps = mid > 0 ? ((bestAsk - bestBid) / mid) * 10_000 : Number.NaN;
      const imbalance =
        bidDepth + askDepth > 0 ? (bidDepth - askDepth) / (bidDepth + askDepth) : Number.NaN;
      const depthRatio = askDepth > 0 ? bidDepth / askDepth : Number.NaN;
      const timestampRaw = Number(row.E ?? row.T ?? Date.now());
      const timestamp = Number.isFinite(timestampRaw) ? timestampRaw : Date.now();
      if (!Number.isFinite(spreadBps) || !Number.isFinite(imbalance) || !Number.isFinite(depthRatio)) {
        return null;
      }

      return {
        timestamp,
        imbalance,
        spreadBps,
        depthRatio,
      } satisfies OrderBookPoint;
    } catch {
      return null;
    }
  }

  private async ensureOrderBookSeriesForCandle(event: StreamCandleEvent) {
    if (event.marketType !== 'FUTURES') return;
    const key = this.getFundingKey(event.marketType, event.symbol);
    const now = this.deps.nowMs();
    const lastFetchAt = this.orderBookLastFetchAt.get(key) ?? 0;
    if (now - lastFetchAt < runtimeOrderBookRefreshMs) return;

    const snapshot = await this.fetchOrderBookSnapshot(event.symbol);
    if (snapshot) {
      this.mergeOrderBookPoints(key, [snapshot]);
    }
    this.orderBookLastFetchAt.set(key, now);
  }

  private resolveOrderBookSeriesForCandles(
    marketType: 'FUTURES' | 'SPOT',
    symbol: string,
    candles: RuntimeCandle[],
  ): {
    orderBookImbalance: Array<number | null>;
    orderBookSpreadBps: Array<number | null>;
    orderBookDepthRatio: Array<number | null>;
  } | null {
    if (marketType !== 'FUTURES') return null;
    const key = this.getFundingKey(marketType, symbol);
    const points = this.orderBookPoints.get(key) ?? [];
    if (points.length === 0) return null;
    return {
      orderBookImbalance: alignTimedNumericPointsToCandles(
        candles,
        points.map((point) => ({
          timestamp: point.timestamp,
          value: point.imbalance,
        })),
      ),
      orderBookSpreadBps: alignTimedNumericPointsToCandles(
        candles,
        points.map((point) => ({
          timestamp: point.timestamp,
          value: point.spreadBps,
        })),
      ),
      orderBookDepthRatio: alignTimedNumericPointsToCandles(
        candles,
        points.map((point) => ({
          timestamp: point.timestamp,
          value: point.depthRatio,
        })),
      ),
    };
  }

  private getSeriesKey(marketType: 'FUTURES' | 'SPOT', symbol: string, interval: string) {
    return `${marketType}|${symbol.toUpperCase()}|${normalizeInterval(interval)}`;
  }

  private getSeries(
    marketType: 'FUTURES' | 'SPOT',
    symbol: string,
    interval?: string | null
  ) {
    const normalizedInterval = normalizeInterval(interval);
    const key = this.getSeriesKey(marketType, symbol, normalizedInterval);
    const exact = this.candleSeries.get(key);
    if (exact && exact.length > 0) return exact;

    const prefix = `${marketType}|${symbol.toUpperCase()}|`;
    const fallbackKey = [...this.candleSeries.keys()].find((entry) => entry.startsWith(prefix));
    if (!fallbackKey) return null;
    const fallbackSeries = this.candleSeries.get(fallbackKey);
    return fallbackSeries && fallbackSeries.length > 0 ? fallbackSeries : null;
  }

  getRecentCloses(input: {
    marketType: 'FUTURES' | 'SPOT';
    symbol: string;
    interval?: string | null;
    limit?: number;
  }) {
    const series = this.getSeries(input.marketType, input.symbol, input.interval);
    if (!series || series.length === 0) return [];
    const closes = series
      .map((candle) => candle.close)
      .filter((value): value is number => Number.isFinite(value));
    if (closes.length === 0) return [];
    const limit = Number.isFinite(input.limit) ? Math.max(1, Math.floor(input.limit as number)) : closes.length;
    return closes.slice(-limit);
  }

  private strategyMatchesCandleInterval(strategyInterval: string | null | undefined, candleInterval: string) {
    if (!strategyInterval) return true;
    return normalizeInterval(strategyInterval) === normalizeInterval(candleInterval);
  }

  private candleConfidence(event: StreamCandleEvent) {
    if (!Number.isFinite(event.open) || event.open === 0) return 0;
    const percentMove = Math.abs((event.close - event.open) / event.open);
    return Math.max(0, Math.min(1, percentMove));
  }

  private buildDecisionWindowKey(input: {
    botId: string;
    groupId: string;
    symbol: string;
    interval: string;
    openTime: number;
    closeTime: number;
  }) {
    return [
      input.botId,
      input.groupId,
      input.symbol.toUpperCase(),
      normalizeInterval(input.interval),
      String(input.openTime),
      String(input.closeTime),
    ].join('|');
  }

  private pruneDecisionWindowDedup(now: number) {
    if (!Number.isFinite(runtimeSignalDecisionDedupeRetentionMs) || runtimeSignalDecisionDedupeRetentionMs <= 0) {
      return;
    }
    for (const [key, processedAt] of this.processedDecisionWindows.entries()) {
      if (now - processedAt > runtimeSignalDecisionDedupeRetentionMs) {
        this.processedDecisionWindows.delete(key);
      }
    }
  }

  private async handleFinalCandleDecision(event: StreamCandleEvent) {
    const bots = await this.deps.listActiveBots();
    await this.deps.closeInactiveRuntimeSessions?.(bots.map((bot) => bot.id));
    await Promise.all(
      bots.map(async (bot) => {
        if (bot.marketType !== event.marketType) return;
        if (bot.exchange !== event.exchange) return;
        const sessionId = await this.deps.ensureRuntimeSession?.({
          userId: bot.userId,
          botId: bot.id,
          mode: bot.mode,
        });

        const eligibleGroups = bot.marketGroups.filter((group) => {
          if (group.symbols.length > 0) {
            const hasSymbol = group.symbols.some(
              (symbol) => symbol.toUpperCase() === event.symbol.toUpperCase()
            );
            if (!hasSymbol) return false;
          }
          return group.strategies.some((strategy) =>
            this.strategyMatchesCandleInterval(strategy.strategyInterval, event.interval)
          );
        });

        await Promise.all(
          eligibleGroups.map(async (group) => {
            const groupEvalStartedAt = this.deps.nowMs();
            const strategyAnalysisById: Record<
              string,
              { conditionLines: RuntimeSignalConditionLine[]; indicatorSummary: string | null }
            > = {};
            const strategyVotes: StrategyVote[] = group.strategies
              .filter((strategy) =>
                this.strategyMatchesCandleInterval(strategy.strategyInterval, event.interval)
              )
              .map((strategy) => {
                const evaluation = this.evaluateStrategy({
                  marketType: bot.marketType,
                  symbol: event.symbol,
                  strategy,
                  decisionOpenTime: event.openTime,
                });
                strategyAnalysisById[strategy.strategyId] = {
                  conditionLines: evaluation.conditionLines,
                  indicatorSummary: evaluation.indicatorSummary,
                };
                const direction = evaluation.direction;
                if (!direction) return null;
                return {
                  strategyId: strategy.strategyId,
                  direction,
                  priority: strategy.priority,
                  weight: strategy.weight,
                } satisfies StrategyVote;
              })
              .filter((vote): vote is StrategyVote => Boolean(vote));

            const merged = mergeRuntimeStrategyVotes({
              strategies: group.strategies,
              votes: strategyVotes,
              minDirectionalScore,
            });
            const direction = merged.direction;
            if (!direction) {
              await this.deps.recordRuntimeEvent?.({
                userId: bot.userId,
                botId: bot.id,
                mode: bot.mode,
                sessionId,
                eventType: 'SIGNAL_DECISION',
                level: 'DEBUG',
                symbol: event.symbol,
                botMarketGroupId: group.id,
                message: 'No trade decision after strategy merge',
                payload: {
                  merge: merged.metadata,
                  analysis: {
                    byStrategy: strategyAnalysisById,
                  },
                },
                eventAt: new Date(event.eventTime),
              });
              metricsStore.recordRuntimeMergeOutcome('NO_TRADE');
              metricsStore.recordRuntimeGroupEvaluation(this.deps.nowMs() - groupEvalStartedAt);
              return;
            }

            const now = this.deps.nowMs();
            this.pruneDecisionWindowDedup(now);
            const decisionWindowKey = this.buildDecisionWindowKey({
              botId: bot.id,
              groupId: group.id,
              symbol: event.symbol,
              interval: event.interval,
              openTime: event.openTime,
              closeTime: event.closeTime,
            });
            if (this.processedDecisionWindows.has(decisionWindowKey)) {
              metricsStore.recordRuntimeGroupEvaluation(this.deps.nowMs() - groupEvalStartedAt);
              return;
            }
            this.processedDecisionWindows.set(decisionWindowKey, now);

            if (direction === 'LONG' || direction === 'SHORT') {
              const openPositionsInGroup = await this.deps.countOpenPositionsForBotAndSymbols({
                userId: bot.userId,
                botId: bot.id,
                symbols: group.symbols,
              });
              if (openPositionsInGroup >= group.maxOpenPositions) {
                return;
              }

              const preTradeDecision = await this.deps.analyzePreTradeFn({
                userId: bot.userId,
                botId: bot.id,
                symbol: event.symbol,
                mode: bot.mode,
                marketType: event.marketType,
              });
              if (!preTradeDecision.allowed) {
                await this.deps.recordRuntimeEvent?.({
                  userId: bot.userId,
                  botId: bot.id,
                  mode: bot.mode,
                  sessionId,
                  eventType: 'PRETRADE_BLOCKED',
                  level: 'WARN',
                  symbol: event.symbol,
                  botMarketGroupId: group.id,
                  strategyId: merged.strategyId,
                  signalDirection: direction,
                  message: 'Pre-trade guard blocked execution',
                  payload: {
                    reasons: preTradeDecision.reasons,
                    metrics: preTradeDecision.metrics,
                  },
                  eventAt: new Date(event.eventTime),
                });
                metricsStore.recordRuntimeMergeOutcome('NO_TRADE');
                metricsStore.recordRuntimeGroupEvaluation(this.deps.nowMs() - groupEvalStartedAt);
                return;
              }
            }

            const strategyExitTraceOnly = direction === 'EXIT';
            const signalEventAt = new Date(event.eventTime);
            await this.deps.createSignal({
              userId: bot.userId,
              botId: bot.id,
              strategyId: merged.strategyId,
              symbol: event.symbol,
              direction,
              confidence: this.candleConfidence(event),
              payload: {
                source: 'market_stream.candle_final',
                botMarketGroupId: group.id,
                symbolGroupId: group.symbolGroupId,
                strategyDriven: true,
                strategyInterval: event.interval,
                merge: merged.metadata,
                strategyExitTraceOnly,
                groupRisk: {
                  maxOpenPositions: group.maxOpenPositions,
                },
                eventTime: event.eventTime,
                candle: {
                  interval: event.interval,
                  openTime: event.openTime,
                  closeTime: event.closeTime,
                  open: event.open,
                  high: event.high,
                  low: event.low,
                  close: event.close,
                  volume: event.volume,
                },
              },
            });
            await this.deps.recordRuntimeEvent?.({
              userId: bot.userId,
              botId: bot.id,
              mode: bot.mode,
              sessionId,
              eventType: 'SIGNAL_DECISION',
              level: 'INFO',
              symbol: event.symbol,
              botMarketGroupId: group.id,
              strategyId: merged.strategyId,
              signalDirection: direction,
              message: strategyExitTraceOnly
                ? 'Strategy EXIT signal recorded (trace-only)'
                : 'Strategy signal accepted for execution',
              payload: {
                merge: merged.metadata,
                strategyExitTraceOnly,
                analysis: {
                  byStrategy: strategyAnalysisById,
                },
              },
              eventAt: signalEventAt,
            });
            await this.deps.upsertRuntimeSymbolStat?.({
              userId: bot.userId,
              botId: bot.id,
              mode: bot.mode,
              sessionId,
              symbol: event.symbol,
              increments: {
                totalSignals: 1,
                ...(direction === 'LONG'
                  ? { longEntries: 1 }
                  : direction === 'SHORT'
                    ? { shortEntries: 1 }
                    : { exits: 1 }),
              },
              lastPrice: event.close,
              lastSignalAt: signalEventAt,
            });

            if (strategyExitTraceOnly) {
              metricsStore.recordRuntimeMergeOutcome('NO_TRADE');
              metricsStore.recordRuntimeGroupEvaluation(this.deps.nowMs() - groupEvalStartedAt);
              return;
            }

            const selectedStrategy = group.strategies.find((strategy) => strategy.strategyId === merged.strategyId);
            const referenceBalance = await resolveRuntimeReferenceBalance({
              userId: bot.userId,
              botId: bot.id,
              walletId: bot.walletId,
              mode: bot.mode,
              exchange: bot.exchange,
              marketType: bot.marketType,
              paperStartBalance: bot.paperStartBalance,
              nowMs: this.deps.nowMs(),
            });
            const orderQuantity = resolveRuntimeOrderQuantity({
              strategy: selectedStrategy,
              price: event.close,
              marketType: bot.marketType,
              referenceBalance,
              runtimeSignalQuantity,
            });
            const leverage = Math.max(1, selectedStrategy?.strategyLeverage ?? 1);
            const insufficientWalletFunds = await resolveRuntimeDcaFundsExhausted({
              userId: bot.userId,
              botId: bot.id,
              walletId: bot.walletId,
              mode: bot.mode,
              exchange: bot.exchange,
              marketType: bot.marketType,
              paperStartBalance: bot.paperStartBalance,
              markPrice: event.close,
              addedQuantity: orderQuantity,
              leverage,
              nowMs: this.deps.nowMs(),
            });
            if (insufficientWalletFunds) {
              await this.deps.recordRuntimeEvent?.({
                userId: bot.userId,
                botId: bot.id,
                mode: bot.mode,
                sessionId,
                eventType: 'PRETRADE_BLOCKED',
                level: 'WARN',
                symbol: event.symbol,
                strategyId: merged.strategyId,
                signalDirection: direction,
                message: `Signal blocked for ${event.symbol} due to insufficient wallet budget`,
                payload: {
                  reason: 'WALLET_INSUFFICIENT_FUNDS',
                  quantity: orderQuantity,
                  markPrice: event.close,
                  leverage,
                },
                eventAt: signalEventAt,
              });
              metricsStore.recordRuntimeMergeOutcome('NO_TRADE');
              metricsStore.recordRuntimeGroupEvaluation(this.deps.nowMs() - groupEvalStartedAt);
              return;
            }

            await this.deps.orchestrateFn({
              userId: bot.userId,
              botId: bot.id,
              walletId: bot.walletId ?? undefined,
              botMarketGroupId: group.id,
              runtimeSessionId: sessionId,
              symbol: event.symbol,
              direction,
              strategyId: merged.strategyId,
              strategyInterval: event.interval,
              quantity: orderQuantity,
              markPrice: event.close,
              mode: bot.mode,
              candleOpenTime: event.openTime,
              candleCloseTime: event.closeTime,
            });
            metricsStore.recordRuntimeMergeOutcome(direction);
            metricsStore.recordRuntimeGroupEvaluation(this.deps.nowMs() - groupEvalStartedAt);
          })
        );
      })
    );
  }

  private evaluateStrategy(input: {
    marketType: 'FUTURES' | 'SPOT';
    symbol: string;
    strategy: ActiveBotStrategy;
    decisionOpenTime: number;
  }): StrategyEvaluation {
    return this.decisionEngine.evaluateStrategy(input);
  }

  private async handleTickerEvent(event: StreamTickerEvent) {
    upsertRuntimeTicker(event);
    await this.deps.processPositionAutomation(event);
  }

  private async processPositionAutomationFallbackFromCandle(event: StreamCandleEvent) {
    const latestTicker = getRuntimeTicker(event.symbol, {
      exchange: event.exchange,
      marketType: event.marketType,
    });
    const tickerIsFresh =
      latestTicker &&
      Math.abs(event.eventTime - latestTicker.eventTime) <= tickerFreshnessFallbackMs;
    if (tickerIsFresh) return;
    await this.deps.processPositionAutomation({
      type: 'ticker',
      exchange: event.exchange,
      marketType: event.marketType,
      symbol: event.symbol,
      eventTime: event.eventTime,
      lastPrice: event.close,
      priceChangePercent24h: 0,
    });
  }
}

export const runtimeSignalLoop = new RuntimeSignalLoop();
