import { SignalDirection } from '@prisma/client';
import { metricsStore } from '../../observability/metrics';
import { normalizeSymbol } from '../../lib/symbols';
import {
  MarketStreamEvent,
  StreamCandleEvent,
  StreamTickerEvent,
} from '../market-stream/binanceStream.types';
import {
  acquireMarketStreamWarmupLock,
  subscribeMarketStreamEvents,
} from '../market-stream/marketStreamFanout';
import { analyzePreTrade } from './preTrade.service';
import { orchestrateRuntimeSignal } from './executionOrchestrator.service';
import { runtimePositionAutomationService } from './runtimePositionAutomation.service';
import { getRuntimeTicker, upsertRuntimeTicker } from './runtimeTickerStore';
import { RuntimeSignalDecisionEngine } from './runtimeSignalDecisionEngine';
import { runtimeTopologyCacheService } from './runtimeTopologyCache.service';
import {
  RuntimeSignalMarketDataGateway,
  RuntimeSignalWarmupLockHandle,
  RuntimeSignalWarmupLockInput,
} from './runtimeSignalMarketDataGateway';
import {
  resolveRuntimeReferenceBalance,
  resolveRuntimeWalletFundsExhausted,
} from './runtimeCapitalContext.service';
import { runtimeTelemetryService } from './runtimeTelemetry.service';
import { runtimeMetricsService } from './runtimeMetrics.service';
import { mergeRuntimeStrategyVotes, StrategyVote } from './runtimeSignalMerge';
import {
  validateRuntimeExchangeOrder,
  RuntimeExchangeOrderGuardResult,
} from './runtimeExchangeOrderGuard.service';
import {
  RuntimeSignalConditionLine,
  StrategyEvaluation,
} from './runtimeSignalEvaluationTypes';
import {
  ActiveBot,
  ActiveBotMarketGroup,
  ActiveBotStrategy,
  deriveRuntimeGroupMaxOpenPositions,
  normalizeInterval,
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
  seriesQueueMaxPending?: number;
  warmupEnabled?: boolean;
  acquireWarmupLock?: (
    input: RuntimeSignalWarmupLockInput
  ) => Promise<RuntimeSignalWarmupLockHandle>;
  validateExchangeOrderFn?: (input: {
    exchange: ActiveBot['exchange'];
    marketType: ActiveBot['marketType'];
    symbol: string;
    quantity: number;
    price: number;
  }) => Promise<RuntimeExchangeOrderGuardResult>;
  listActiveBotsFromTopologyCache?: () => Promise<ActiveBot[]>;
  invalidateRuntimeTopologyCache?: () => void;
};

const runtimeSignalQuantity = Number.parseFloat(process.env.RUNTIME_SIGNAL_QUANTITY ?? '0.01');
const runtimeSignalDecisionDedupeRetentionMs = Number.parseInt(
  process.env.RUNTIME_SIGNAL_DEDUPE_RETENTION_MS ?? '21600000',
  10
);
const minDirectionalScore = Number.parseFloat(process.env.RUNTIME_SIGNAL_MIN_DIRECTIONAL_SCORE ?? '1');
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
const runtimeSeriesQueueMaxPending = Math.max(
  1,
  Number.parseInt(process.env.RUNTIME_SIGNAL_SERIES_QUEUE_MAX_PENDING ?? '64', 10)
);

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
  validateExchangeOrderFn: (params) => validateRuntimeExchangeOrder(params),
  listActiveBotsFromTopologyCache: () => runtimeTopologyCacheService.getActiveBots(),
  invalidateRuntimeTopologyCache: () => runtimeTopologyCacheService.invalidate(),
  acquireWarmupLock: (input) => acquireMarketStreamWarmupLock(input),
};

type RuntimeSignalRouteEntry = {
  bot: ActiveBot;
  group: ActiveBotMarketGroup;
};

type RuntimeQueuedCandleEvent = {
  event: StreamCandleEvent;
  resolve: () => void;
  reject: (error: unknown) => void;
};

export class RuntimeSignalLoop {
  private unsubscribe: (() => Promise<void>) | null = null;
  private sessionWatchdogTimer: NodeJS.Timeout | null = null;
  private autoRestartTimer: NodeJS.Timeout | null = null;
  private readonly autoRestartAttempts: number[] = [];
  private readonly processedDecisionWindows = new Map<string, number>();
  private readonly marketDataGateway = new RuntimeSignalMarketDataGateway({
    nowMs: () => this.deps.nowMs(),
    warmupEnabled: () => this.deps.warmupEnabled,
    acquireWarmupLock: (input) =>
      this.deps.acquireWarmupLock?.(input) ??
      Promise.resolve({
        acquired: true,
        release: async () => undefined,
      }),
  });
  private routedTopologyRef: ActiveBot[] | null = null;
  private readonly routeEntriesBySeriesKey = new Map<string, RuntimeSignalRouteEntry[]>();
  private readonly routeBotsByMarketKey = new Map<string, ActiveBot[]>();
  private readonly queuedCandleEventsBySeriesKey = new Map<string, RuntimeQueuedCandleEvent[]>();
  private readonly processingSeriesKeys = new Set<string>();
  private lastStreamEventAtMs: number | null = null;
  private lastSessionSyncSuccessAtMs: number | null = null;
  private lastKnownActiveBotIds = new Set<string>();

  private readonly decisionEngine = new RuntimeSignalDecisionEngine({
    getSeries: (marketType, symbol, interval) =>
      this.marketDataGateway.getSeries(marketType, symbol, interval),
    resolveFundingRateSeriesForCandles: (marketType, symbol, candles) =>
      this.marketDataGateway.resolveFundingRateSeriesForCandles(marketType, symbol, candles),
    resolveOpenInterestSeriesForCandles: (marketType, symbol, candles) =>
      this.marketDataGateway.resolveOpenInterestSeriesForCandles(marketType, symbol, candles),
    resolveOrderBookSeriesForCandles: (marketType, symbol, candles) =>
      this.marketDataGateway.resolveOrderBookSeriesForCandles(marketType, symbol, candles),
  });

  constructor(private readonly deps: RuntimeSignalLoopDeps = defaultDeps) {}

  private get candleSeries() {
    return this.marketDataGateway.getCandleSeriesStore();
  }

  private get fundingRatePoints() {
    return this.marketDataGateway.getFundingRatePointsStore();
  }

  private get openInterestPoints() {
    return this.marketDataGateway.getOpenInterestPointsStore();
  }

  private get orderBookPoints() {
    return this.marketDataGateway.getOrderBookPointsStore();
  }

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
    const activeBots = await this.listActiveBotsDirectWithMetrics();
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
    this.deps.invalidateRuntimeTopologyCache?.();
    this.clearRuntimeRoutingIndex();
    this.clearRuntimeSeriesEventQueues();
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
    const activeBots = await this.listActiveBotsDirectWithMetrics();
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

  private async listActiveBotsDirectWithMetrics() {
    return runtimeMetricsService.measureListActiveBots(async () => this.deps.listActiveBots());
  }

  private async listActiveBotsFromTopologyCacheWithMetrics() {
    const listActiveBotsFromTopologyCache = this.deps.listActiveBotsFromTopologyCache;
    if (!listActiveBotsFromTopologyCache) {
      const topology = await this.listActiveBotsDirectWithMetrics();
      this.rebuildRuntimeRoutingIndex(topology);
      return topology;
    }

    try {
      const topology = await runtimeMetricsService.measureListActiveBots(async () =>
        listActiveBotsFromTopologyCache()
      );
      this.rebuildRuntimeRoutingIndex(topology);
      return topology;
    } catch (error) {
      console.error('RuntimeSignalLoop topology cache read failed. Falling back to direct query.', error);
      metricsStore.recordRuntimeExecutionError('runtime_topology_cache_read_failure');
      const topology = await this.listActiveBotsDirectWithMetrics();
      this.rebuildRuntimeRoutingIndex(topology);
      return topology;
    }
  }

  private clearRuntimeRoutingIndex() {
    this.routedTopologyRef = null;
    this.routeEntriesBySeriesKey.clear();
    this.routeBotsByMarketKey.clear();
  }

  private buildRuntimeMarketKey(exchange: ActiveBot['exchange'], marketType: ActiveBot['marketType']) {
    return `${exchange}|${marketType}`;
  }

  private buildRuntimeSeriesRouteKey(input: {
    marketKey: string;
    symbol: string;
    interval: string;
  }) {
    return `${input.marketKey}|${input.symbol}|${input.interval}`;
  }

  private buildRuntimeSeriesEventKey(event: StreamCandleEvent) {
    const symbolKey = normalizeSymbol(event.symbol);
    const intervalKey = normalizeInterval(event.interval);
    return `${event.exchange}|${event.marketType}|${symbolKey}|${intervalKey}`;
  }

  private resolveSeriesQueueMaxPending() {
    if (Number.isFinite(this.deps.seriesQueueMaxPending as number)) {
      return Math.max(1, Math.floor(this.deps.seriesQueueMaxPending as number));
    }
    return runtimeSeriesQueueMaxPending;
  }

  private clearRuntimeSeriesEventQueues() {
    for (const queue of this.queuedCandleEventsBySeriesKey.values()) {
      for (const queuedEvent of queue) {
        queuedEvent.resolve();
      }
    }
    this.queuedCandleEventsBySeriesKey.clear();
    this.processingSeriesKeys.clear();
  }

  private dequeueQueuedRuntimeCandleEvent(seriesKey: string) {
    const queue = this.queuedCandleEventsBySeriesKey.get(seriesKey);
    const next = queue?.shift();
    if (!queue || queue.length === 0) {
      this.queuedCandleEventsBySeriesKey.delete(seriesKey);
    }
    return next ?? null;
  }

  private enqueueFinalCandleEvent(event: StreamCandleEvent) {
    const seriesKey = this.buildRuntimeSeriesEventKey(event);
    return new Promise<void>((resolve, reject) => {
      const queuedEvent: RuntimeQueuedCandleEvent = { event, resolve, reject };
      if (!this.processingSeriesKeys.has(seriesKey)) {
        this.processingSeriesKeys.add(seriesKey);
        void this.drainRuntimeSeriesQueue(seriesKey, queuedEvent);
        return;
      }

      const queue = this.queuedCandleEventsBySeriesKey.get(seriesKey) ?? [];
      const maxPending = this.resolveSeriesQueueMaxPending();
      if (queue.length >= maxPending) {
        const droppedEvent = queue.shift();
        droppedEvent?.resolve();
        metricsStore.recordRuntimeExecutionError('runtime_series_queue_overflow');
      }
      queue.push(queuedEvent);
      this.queuedCandleEventsBySeriesKey.set(seriesKey, queue);
    });
  }

  private async drainRuntimeSeriesQueue(seriesKey: string, initialEvent: RuntimeQueuedCandleEvent) {
    let current: RuntimeQueuedCandleEvent | null = initialEvent;
    try {
      while (current) {
        try {
          await this.handleCandleEvent(current.event);
          current.resolve();
        } catch (error) {
          current.reject(error);
          console.error('RuntimeSignalLoop candle processing failed:', error);
          metricsStore.recordRuntimeExecutionError('runtime_candle_handler_failure');
        }
        current = this.dequeueQueuedRuntimeCandleEvent(seriesKey);
      }
    } finally {
      this.processingSeriesKeys.delete(seriesKey);
      const nextQueuedEvent = this.dequeueQueuedRuntimeCandleEvent(seriesKey);
      if (nextQueuedEvent) {
        this.processingSeriesKeys.add(seriesKey);
        void this.drainRuntimeSeriesQueue(seriesKey, nextQueuedEvent);
      }
    }
  }

  private rebuildRuntimeRoutingIndex(topology: ActiveBot[]) {
    if (this.routedTopologyRef === topology) return;
    this.clearRuntimeRoutingIndex();
    this.routedTopologyRef = topology;

    for (const bot of topology) {
      const marketKey = this.buildRuntimeMarketKey(bot.exchange, bot.marketType);
      const marketBots = this.routeBotsByMarketKey.get(marketKey);
      if (marketBots) {
        marketBots.push(bot);
      } else {
        this.routeBotsByMarketKey.set(marketKey, [bot]);
      }

      for (const group of bot.marketGroups) {
        if (group.strategies.length === 0) continue;

        const symbolKeys = group.symbols
          .map((symbol) => normalizeSymbol(symbol))
          .filter((symbol): symbol is string => symbol.length > 0);
        const effectiveSymbolKeys = symbolKeys.length > 0 ? symbolKeys : ['*'];
        const intervalKeys = Array.from(
          new Set(
            group.strategies.map((strategy) =>
              strategy.strategyInterval ? normalizeInterval(strategy.strategyInterval) : '*'
            )
          )
        );
        const effectiveIntervalKeys = intervalKeys.length > 0 ? intervalKeys : ['*'];

        for (const symbolKey of effectiveSymbolKeys) {
          for (const intervalKey of effectiveIntervalKeys) {
            const routeKey = this.buildRuntimeSeriesRouteKey({
              marketKey,
              symbol: symbolKey,
              interval: intervalKey,
            });
            const routeEntries = this.routeEntriesBySeriesKey.get(routeKey);
            if (routeEntries) {
              routeEntries.push({ bot, group });
            } else {
              this.routeEntriesBySeriesKey.set(routeKey, [{ bot, group }]);
            }
          }
        }
      }
    }

    for (const [marketKey, marketBots] of this.routeBotsByMarketKey.entries()) {
      this.routeBotsByMarketKey.set(
        marketKey,
        [...marketBots].sort((left, right) => left.id.localeCompare(right.id))
      );
    }

    for (const [routeKey, routeEntries] of this.routeEntriesBySeriesKey.entries()) {
      this.routeEntriesBySeriesKey.set(
        routeKey,
        [...routeEntries].sort((left, right) => {
          if (left.bot.id !== right.bot.id) {
            return left.bot.id.localeCompare(right.bot.id);
          }
          if (left.group.executionOrder !== right.group.executionOrder) {
            return left.group.executionOrder - right.group.executionOrder;
          }
          return left.group.id.localeCompare(right.group.id);
        })
      );
    }
  }

  private resolveRuntimeRoutesForEvent(event: StreamCandleEvent, topology: ActiveBot[]) {
    if (this.routedTopologyRef !== topology) {
      this.rebuildRuntimeRoutingIndex(topology);
    }

    const marketKey = this.buildRuntimeMarketKey(event.exchange, event.marketType);
    if (!this.routeBotsByMarketKey.has(marketKey)) return [];
    const symbolKey = normalizeSymbol(event.symbol);
    if (!symbolKey) return [];
    const intervalKey = normalizeInterval(event.interval);
    const candidateRouteKeys = [
      this.buildRuntimeSeriesRouteKey({
        marketKey,
        symbol: symbolKey,
        interval: intervalKey,
      }),
      this.buildRuntimeSeriesRouteKey({
        marketKey,
        symbol: symbolKey,
        interval: '*',
      }),
      this.buildRuntimeSeriesRouteKey({
        marketKey,
        symbol: '*',
        interval: intervalKey,
      }),
      this.buildRuntimeSeriesRouteKey({
        marketKey,
        symbol: '*',
        interval: '*',
      }),
    ];
    const seenRouteKeys = new Set<string>();
    const resolvedRoutes: RuntimeSignalRouteEntry[] = [];

    for (const routeKey of candidateRouteKeys) {
      const routeEntries = this.routeEntriesBySeriesKey.get(routeKey);
      if (!routeEntries?.length) continue;
      for (const routeEntry of routeEntries) {
        const dedupeKey = `${routeEntry.bot.id}|${routeEntry.group.id}`;
        if (seenRouteKeys.has(dedupeKey)) continue;
        seenRouteKeys.add(dedupeKey);
        resolvedRoutes.push(routeEntry);
      }
    }

    return resolvedRoutes;
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
    this.deps.invalidateRuntimeTopologyCache?.();
    this.clearRuntimeRoutingIndex();
    this.clearRuntimeSeriesEventQueues();
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
      if (event.isFinal) {
        await this.enqueueFinalCandleEvent(event);
        return;
      }
      await this.handleCandleEvent(event);
      return;
    }
    if (event.type === 'ticker') {
      await this.handleTickerEvent(event);
    }
  }

  private async handleCandleEvent(event: StreamCandleEvent) {
    if (!event.isFinal) return;
    await this.marketDataGateway.ingestCandleEvent(event);
    await this.processPositionAutomationFallbackFromCandle(event);
    await this.handleFinalCandleDecision(event);
  }

  getRecentCloses(input: {
    marketType: 'FUTURES' | 'SPOT';
    symbol: string;
    interval?: string | null;
    limit?: number;
  }) {
    return this.marketDataGateway.getRecentCloses(input);
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
      normalizeSymbol(input.symbol),
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
    const bots = await this.listActiveBotsFromTopologyCacheWithMetrics();
    await this.deps.closeInactiveRuntimeSessions?.(bots.map((bot) => bot.id));
    const managedExternalSymbolKeys = new Set<string>();
    try {
      const managedExternalPositions = await this.deps.listRuntimeManagedExternalPositions();
      for (const position of managedExternalPositions) {
        const normalizedSymbol = normalizeSymbol(position.symbol);
        if (!normalizedSymbol) continue;
        managedExternalSymbolKeys.add(`${position.userId}:${normalizedSymbol}`);
      }
    } catch (error) {
      console.error('RuntimeSignalLoop managed external positions lookup failed:', error);
      metricsStore.recordRuntimeExecutionError('runtime_external_positions_lookup_failure');
    }
    const runtimeRoutes = this.resolveRuntimeRoutesForEvent(event, bots);
    runtimeMetricsService.recordEligibleGroupsCount(runtimeRoutes.length);
    const runtimeSessionByBotId = new Map<string, string | undefined>();

    await Promise.all(
      runtimeRoutes.map(async ({ bot, group }) => {
        if (!runtimeSessionByBotId.has(bot.id)) {
          const ensuredSessionId = await this.deps.ensureRuntimeSession?.({
            userId: bot.userId,
            botId: bot.id,
            mode: bot.mode,
          });
          runtimeSessionByBotId.set(bot.id, ensuredSessionId);
        }
        const sessionId = runtimeSessionByBotId.get(bot.id);

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
              const managedExternalKey = `${bot.userId}:${normalizeSymbol(event.symbol)}`;
              if (managedExternalSymbolKeys.has(managedExternalKey)) {
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
                  message: 'Signal blocked due to managed external position on symbol',
                  payload: {
                    reason: 'EXTERNAL_POSITION_ALREADY_OPEN',
                  },
                  eventAt: new Date(event.eventTime),
                });
                metricsStore.recordRuntimeMergeOutcome('NO_TRADE');
                metricsStore.recordRuntimeGroupEvaluation(this.deps.nowMs() - groupEvalStartedAt);
                return;
              }

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
            if (bot.mode === 'LIVE') {
              const exchangeOrderValidation = await this.deps.validateExchangeOrderFn?.({
                exchange: bot.exchange,
                marketType: bot.marketType,
                symbol: event.symbol,
                quantity: orderQuantity,
                price: event.close,
              });

              if (exchangeOrderValidation && !exchangeOrderValidation.allowed) {
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
                  message: `Signal blocked for ${event.symbol} due to exchange order constraints`,
                  payload: {
                    reason: 'EXCHANGE_MIN_ORDER_CONSTRAINT',
                    constraintReason: exchangeOrderValidation.reason,
                    quantity: orderQuantity,
                    markPrice: event.close,
                    leverage,
                    exchange: bot.exchange,
                    marketType: bot.marketType,
                    details: exchangeOrderValidation.details,
                  },
                  eventAt: signalEventAt,
                });
                metricsStore.recordRuntimeMergeOutcome('NO_TRADE');
                metricsStore.recordRuntimeGroupEvaluation(this.deps.nowMs() - groupEvalStartedAt);
                return;
              }
            }

            const insufficientWalletFunds = await resolveRuntimeWalletFundsExhausted({
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
              strategyLeverage: leverage,
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
