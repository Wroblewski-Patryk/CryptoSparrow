import { Exchange, Prisma, SignalDirection } from '@prisma/client';
import { prisma } from '../../prisma/client';
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
import {
  evaluateStrategySignalAtIndex,
  parseStrategySignalRules,
} from './strategySignalEvaluator';
import { computeRiskBasedOrderQuantity, normalizeWalletRiskPercent } from './positionSizing';
import { resolveRuntimeReferenceBalance } from './runtimeCapitalContext.service';
import { runtimeTelemetryService } from './runtimeTelemetry.service';
import { supportsExchangeCapability } from '../exchange/exchangeCapabilities';
import { getMarketCatalog } from '../markets/markets.service';

type ActiveBotStrategy = {
  strategyId: string;
  strategyInterval: string | null;
  strategyConfig: Record<string, unknown> | null;
  strategyLeverage: number;
  walletRisk: number;
  priority: number;
  weight: number;
};

type ActiveBotMarketGroup = {
  id: string;
  symbolGroupId: string;
  executionOrder: number;
  maxOpenPositions: number;
  symbols: string[];
  strategies: ActiveBotStrategy[];
};

type ActiveBot = {
  id: string;
  userId: string;
  mode: 'PAPER' | 'LIVE';
  exchange: Exchange;
  paperStartBalance: number;
  marketType: 'FUTURES' | 'SPOT';
  marketGroups: ActiveBotMarketGroup[];
};

const normalizeSymbols = (symbols: string[]) =>
  [...new Set(symbols.map((item) => item.trim().toUpperCase()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

const resolveUniverseSymbols = (whitelist: string[], blacklist: string[]) => {
  const normalizedWhitelist = normalizeSymbols(whitelist);
  const blacklistSet = new Set(normalizeSymbols(blacklist));
  return normalizedWhitelist.filter((symbol) => !blacklistSet.has(symbol));
};

const resolveMinQuoteVolumeFilter = (filterRules: unknown) => {
  const parsedRules =
    filterRules && typeof filterRules === 'object'
      ? (filterRules as {
          minQuoteVolumeEnabled?: unknown;
          minQuoteVolume24h?: unknown;
          minVolume24h?: unknown;
        })
      : null;
  const enabled = parsedRules?.minQuoteVolumeEnabled === true;
  const minRaw = Number(parsedRules?.minQuoteVolume24h ?? parsedRules?.minVolume24h ?? 0);
  const min = Number.isFinite(minRaw) && minRaw > 0 ? minRaw : 0;
  return { enabled, min };
};

const resolveCatalogSymbolsForUniverse = async (
  universe: {
    exchange: Exchange;
    marketType: 'FUTURES' | 'SPOT';
    baseCurrency: string;
    filterRules: unknown;
    blacklist: string[];
  },
  cache: Map<string, string[]>
) => {
  const volumeFilter = resolveMinQuoteVolumeFilter(universe.filterRules);
  const cacheKey = [
    universe.exchange,
    universe.marketType,
    universe.baseCurrency.toUpperCase(),
    volumeFilter.enabled ? '1' : '0',
    volumeFilter.min.toString(),
    normalizeSymbols(universe.blacklist).join(','),
  ].join('|');
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const catalog = await getMarketCatalog(
      universe.baseCurrency,
      universe.marketType,
      universe.exchange
    );
    const blacklistSet = new Set(normalizeSymbols(universe.blacklist));
    const symbols = normalizeSymbols(
      catalog.markets
        .filter((market) =>
          volumeFilter.enabled ? (market.quoteVolume24h ?? 0) >= volumeFilter.min : true
        )
        .map((market) => market.symbol)
    ).filter((symbol) => !blacklistSet.has(symbol));
    cache.set(cacheKey, symbols);
    return symbols;
  } catch {
    cache.set(cacheKey, []);
    return [];
  }
};

export const supportsRuntimeSignalLoopExchange = (bot: Pick<ActiveBot, 'exchange' | 'mode'>) =>
  supportsExchangeCapability(
    bot.exchange,
    bot.mode === 'LIVE' ? 'LIVE_EXECUTION' : 'PAPER_PRICING_FEED'
  );

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
  Number.parseInt(process.env.RUNTIME_STALL_NO_EVENT_MS ?? '180000', 10)
);
const runtimeStallNoHeartbeatMs = Math.max(
  runtimeSessionWatchdogIntervalMs * 2,
  Number.parseInt(process.env.RUNTIME_STALL_NO_HEARTBEAT_MS ?? '60000', 10)
);

type RuntimeCandle = {
  openTime: number;
  close: number;
};

type StrategyVote = {
  strategyId: string;
  direction: SignalDirection;
  priority: number;
  weight: number;
};

type RuntimeSignalConditionLine = {
  scope: 'LONG' | 'SHORT';
  left: string;
  value: string;
  operator: string;
  right: string;
};

type StrategyEvaluation = {
  direction: SignalDirection | null;
  conditionLines: RuntimeSignalConditionLine[];
  indicatorSummary: string | null;
};

type MergedStrategyDecision = {
  direction: SignalDirection | null;
  strategyId?: string;
  metadata: Record<string, unknown>;
};

const defaultDeps: RuntimeSignalLoopDeps = {
  subscribe: subscribeMarketStreamEvents,
  listActiveBots: async () => {
    const bots = await prisma.bot.findMany({
      where: {
        isActive: true,
        mode: { in: ['PAPER', 'LIVE'] },
      },
      select: {
        id: true,
        userId: true,
        mode: true,
        exchange: true,
        paperStartBalance: true,
        marketType: true,
        botMarketGroups: {
          where: {
            isEnabled: true,
            lifecycleStatus: { in: ['ACTIVE', 'PAUSED'] },
          },
          include: {
            symbolGroup: {
              select: {
                id: true,
                symbols: true,
                marketUniverse: {
                  select: {
                    exchange: true,
                    marketType: true,
                    baseCurrency: true,
                    filterRules: true,
                    whitelist: true,
                    blacklist: true,
                  },
                },
              },
            },
            strategyLinks: {
              where: { isEnabled: true },
              orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
              include: {
                strategy: {
                  select: {
                    interval: true,
                    config: true,
                    leverage: true,
                    walletRisk: true,
                  },
                },
              },
            },
          },
          orderBy: [{ executionOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    const activeBots = bots.filter(supportsRuntimeSignalLoopExchange);
    const catalogSymbolsCache = new Map<string, string[]>();

    return Promise.all(
      activeBots.map(async (bot) => {
        const marketGroupsFromNewModel: ActiveBotMarketGroup[] = [];
        for (const group of bot.botMarketGroups) {
          const strategies = group.strategyLinks.map((link) => ({
            strategyId: link.strategyId,
            strategyInterval: link.strategy.interval,
            strategyConfig: (link.strategy.config as Record<string, unknown> | undefined) ?? null,
            strategyLeverage: link.strategy.leverage,
            walletRisk: normalizeWalletRiskPercent(link.strategy.walletRisk, 1),
            priority: link.priority,
            weight: link.weight,
          }));

          const symbolGroupSymbols = normalizeSymbols(group.symbolGroup.symbols ?? []);
          const universeSymbols = group.symbolGroup.marketUniverse
            ? resolveUniverseSymbols(
                group.symbolGroup.marketUniverse.whitelist ?? [],
                group.symbolGroup.marketUniverse.blacklist ?? []
              )
            : [];
          const catalogFallbackSymbols =
            group.symbolGroup.marketUniverse &&
            symbolGroupSymbols.length === 0 &&
            universeSymbols.length === 0
              ? await resolveCatalogSymbolsForUniverse(
                  {
                    exchange: group.symbolGroup.marketUniverse.exchange,
                    marketType: group.symbolGroup.marketUniverse.marketType,
                    baseCurrency: group.symbolGroup.marketUniverse.baseCurrency,
                    filterRules: group.symbolGroup.marketUniverse.filterRules,
                    blacklist: group.symbolGroup.marketUniverse.blacklist ?? [],
                  },
                  catalogSymbolsCache
                )
              : [];
          const symbols =
            universeSymbols.length > 0
              ? universeSymbols
              : symbolGroupSymbols.length > 0
                ? symbolGroupSymbols
                : catalogFallbackSymbols;

          marketGroupsFromNewModel.push({
            id: group.id,
            symbolGroupId: group.symbolGroupId,
            executionOrder: group.executionOrder,
            maxOpenPositions: deriveRuntimeGroupMaxOpenPositions({
              configuredGroupMaxOpenPositions: group.maxOpenPositions,
              strategies,
            }),
            symbols,
            strategies,
          });
        }

        return {
          id: bot.id,
          userId: bot.userId,
          mode: bot.mode as 'PAPER' | 'LIVE',
          exchange: bot.exchange,
          paperStartBalance: Number.isFinite(bot.paperStartBalance) ? Math.max(0, bot.paperStartBalance) : 10_000,
          marketType: bot.marketType,
          marketGroups: [...marketGroupsFromNewModel].sort(
            (left, right) => left.executionOrder - right.executionOrder
          ),
        };
      })
    );
  },
  listRuntimeManagedExternalPositions: async () => {
    const positions = await prisma.position.findMany({
      where: {
        status: 'OPEN',
        botId: null,
        managementMode: 'BOT_MANAGED',
      },
      select: {
        userId: true,
        symbol: true,
      },
      distinct: ['userId', 'symbol'],
    });
    return positions.map((position) => ({
      userId: position.userId,
      symbol: position.symbol,
    }));
  },
  countOpenPositionsForBotAndSymbols: async ({ userId, botId, symbols }) => {
    const normalizedSymbols = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))];
    return prisma.position.count({
      where: {
        userId,
        botId,
        status: 'OPEN',
        ...(normalizedSymbols.length > 0 ? { symbol: { in: normalizedSymbols } } : {}),
      },
    });
  },
  createSignal: async (params) => {
    await prisma.signal.create({
      data: {
        userId: params.userId,
        botId: params.botId,
        strategyId: params.strategyId,
        symbol: params.symbol,
        timeframe: '1m',
        direction: params.direction,
        confidence: params.confidence,
        payload: params.payload as Prisma.InputJsonValue,
      },
    });
  },
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

const resolveRuntimeOrderQuantity = (input: {
  strategy: ActiveBotStrategy | undefined;
  price: number;
  marketType: 'FUTURES' | 'SPOT';
  referenceBalance: number;
}) => {
  const strategy = input.strategy;
  if (!strategy) return runtimeSignalQuantity;
  return computeRiskBasedOrderQuantity({
    price: input.price,
    walletRiskPercent: strategy.walletRisk,
    referenceBalance: input.referenceBalance,
    leverage: input.marketType === 'SPOT' ? 1 : Math.max(1, strategy.strategyLeverage),
    minQuantity: runtimeSignalQuantity,
  });
};

const normalizeInterval = (value?: string | null) => {
  if (!value) return '1m';
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, string> = {
    '1 min': '1m',
    '3 min': '3m',
    '5 min': '5m',
    '10 min': '10m',
    '15 min': '15m',
    '30 min': '30m',
    '60 min': '1h',
  };
  return aliases[normalized] ?? normalized;
};

const formatIndicatorValue = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return 'X';
  return Number(value.toFixed(4)).toString();
};

const formatRuleTarget = (value: number) => Number(value.toFixed(6)).toString();

const clampPeriod = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(2, Math.floor(parsed));
};

const computeEmaSeriesFromRuntimeCandles = (candles: RuntimeCandle[], period: number): Array<number | null> => {
  const alpha = 2 / (period + 1);
  let ema: number | null = null;
  const output: Array<number | null> = [];
  for (let index = 0; index < candles.length; index += 1) {
    const price = candles[index].close;
    if (!Number.isFinite(price)) {
      output.push(null);
      continue;
    }
    if (ema === null) ema = price;
    else ema = alpha * price + (1 - alpha) * ema;
    output.push(index + 1 >= period ? ema : null);
  }
  return output;
};

const computeRsiSeriesFromRuntimeCandles = (candles: RuntimeCandle[], period: number): Array<number | null> => {
  const output: Array<number | null> = Array.from({ length: candles.length }, () => null);
  if (candles.length <= period) return output;

  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const diff = candles[index].close - candles[index - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  output[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let index = period + 1; index < candles.length; index += 1) {
    const diff = candles[index].close - candles[index - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    output[index] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return output;
};

const computeMomentumSeriesFromRuntimeCandles = (candles: RuntimeCandle[], period: number): Array<number | null> => {
  const output: Array<number | null> = [];
  for (let index = 0; index < candles.length; index += 1) {
    if (index < period) {
      output.push(null);
      continue;
    }
    output.push(candles[index].close - candles[index - period].close);
  }
  return output;
};

const toPositiveInteger = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
};

const extractStrategyMaxOpenPositions = (strategyConfig: Record<string, unknown> | null | undefined) => {
  if (!strategyConfig || typeof strategyConfig !== 'object') return null;
  const additional =
    strategyConfig.additional && typeof strategyConfig.additional === 'object'
      ? (strategyConfig.additional as Record<string, unknown>)
      : null;
  if (!additional) return null;
  return toPositiveInteger(additional.maxPositions ?? additional.maxOpenPositions);
};

export const deriveRuntimeGroupMaxOpenPositions = (input: {
  configuredGroupMaxOpenPositions: number;
  strategies: Array<{ strategyConfig: Record<string, unknown> | null }>;
}) => {
  const strategyCaps = input.strategies
    .map((strategy) => extractStrategyMaxOpenPositions(strategy.strategyConfig))
    .filter((value): value is number => Number.isFinite(value as number) && (value as number) > 0);

  if (strategyCaps.length > 0) {
    return Math.max(1, Math.min(...strategyCaps));
  }

  return toPositiveInteger(input.configuredGroupMaxOpenPositions) ?? 1;
};


export class RuntimeSignalLoop {
  private unsubscribe: (() => Promise<void>) | null = null;
  private sessionWatchdogTimer: NodeJS.Timeout | null = null;
  private readonly processedDecisionWindows = new Map<string, number>();
  private readonly candleSeries = new Map<string, RuntimeCandle[]>();
  private readonly warmupLastAttemptAt = new Map<string, number>();
  private lastStreamEventAtMs: number | null = null;
  private lastSessionSyncSuccessAtMs: number | null = null;
  private lastKnownActiveBotIds = new Set<string>();

  constructor(private readonly deps: RuntimeSignalLoopDeps = defaultDeps) {}

  isRunning() {
    return this.unsubscribe !== null;
  }

  async start() {
    if (this.unsubscribe) return;
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
    await Promise.all(
      activeBotIds.map((botId) =>
        this.deps.closeRuntimeSession?.({
          botId,
          status: 'CANCELED',
          stopReason: reason,
        })
      )
    );
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
      close: event.close,
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
    await this.ensureSeriesWarmup(event.marketType, event.symbol, event.interval);
    await this.processPositionAutomationFallbackFromCandle(event);
    await this.handleFinalCandleDecision(event);
  }

  private warmupUrl(marketType: 'FUTURES' | 'SPOT', symbol: string, interval: string, limit: number) {
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
    return `${base}${endpoint}?${params.toString()}`;
  }

  private async fetchWarmupCandles(
    marketType: 'FUTURES' | 'SPOT',
    symbol: string,
    interval: string,
    limit: number
  ): Promise<RuntimeCandle[]> {
    if (process.env.NODE_ENV === 'test') return [];
    const url = this.warmupUrl(marketType, symbol, interval, limit);
    try {
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) return [];
      const payload = (await response.json()) as unknown;
      if (!Array.isArray(payload)) return [];
      const now = Date.now();
      return payload
        .map((item) => {
          if (!Array.isArray(item)) return null;
          const openTime = Number(item[0]);
          const close = Number(item[4]);
          const closeTime = Number(item[6]);
          if (!Number.isFinite(openTime) || !Number.isFinite(close)) return null;
          if (Number.isFinite(closeTime) && closeTime > now) return null;
          return {
            openTime,
            close,
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
    interval: string
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
      runtimeSignalWarmupCandles
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

            const merged = this.mergeStrategyVotes(group.strategies, strategyVotes);
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
            });

            await this.deps.orchestrateFn({
              userId: bot.userId,
              botId: bot.id,
              runtimeSessionId: sessionId,
              symbol: event.symbol,
              direction,
              strategyId: merged.strategyId,
              quantity: orderQuantity,
              markPrice: event.close,
              mode: bot.mode,
            });
            metricsStore.recordRuntimeMergeOutcome(direction);
            metricsStore.recordRuntimeGroupEvaluation(this.deps.nowMs() - groupEvalStartedAt);
          })
        );
      })
    );
  }

  private mergeStrategyVotes(strategies: ActiveBotStrategy[], votes: StrategyVote[]): MergedStrategyDecision {
    if (votes.length === 0) {
      return {
        direction: null,
        metadata: {
          mergePolicy: 'weighted_exit_priority',
          reason: 'no_votes',
        },
      };
    }

    const exitVotes = votes
      .filter((vote) => vote.direction === 'EXIT')
      .sort((left, right) => {
        if (left.priority !== right.priority) return left.priority - right.priority;
        return left.strategyId.localeCompare(right.strategyId);
      });

    if (exitVotes.length > 0) {
      const winner = exitVotes[0];
      return {
        direction: 'EXIT',
        strategyId: winner.strategyId,
        metadata: {
          mergePolicy: 'weighted_exit_priority',
          reason: 'exit_priority',
          votes: votes.map((vote) => ({
            strategyId: vote.strategyId,
            direction: vote.direction,
            priority: vote.priority,
            weight: vote.weight,
          })),
          winner: {
            strategyId: winner.strategyId,
            priority: winner.priority,
            weight: winner.weight,
          },
        },
      };
    }

    const longScore = votes
      .filter((vote) => vote.direction === 'LONG')
      .reduce((accumulator, vote) => accumulator + vote.weight, 0);
    const shortScore = votes
      .filter((vote) => vote.direction === 'SHORT')
      .reduce((accumulator, vote) => accumulator + vote.weight, 0);

    if (longScore === shortScore) {
      return {
        direction: null,
        metadata: {
          mergePolicy: 'weighted_exit_priority',
          reason: 'tie',
          scores: { longScore, shortScore, minDirectionalScore },
          votes: votes.map((vote) => ({
            strategyId: vote.strategyId,
            direction: vote.direction,
            priority: vote.priority,
            weight: vote.weight,
          })),
        },
      };
    }

    const winnerDirection: SignalDirection = longScore > shortScore ? 'LONG' : 'SHORT';
    const winnerScore = winnerDirection === 'LONG' ? longScore : shortScore;
    if (winnerScore < minDirectionalScore) {
      return {
        direction: null,
        metadata: {
          mergePolicy: 'weighted_exit_priority',
          reason: 'weak_consensus',
          scores: { longScore, shortScore, minDirectionalScore },
          votes: votes.map((vote) => ({
            strategyId: vote.strategyId,
            direction: vote.direction,
            priority: vote.priority,
            weight: vote.weight,
          })),
        },
      };
    }

    const winnerVotes = votes
      .filter((vote) => vote.direction === winnerDirection)
      .sort((left, right) => {
        if (left.priority !== right.priority) return left.priority - right.priority;
        if (left.weight !== right.weight) return right.weight - left.weight;
        return left.strategyId.localeCompare(right.strategyId);
      });

    const winner = winnerVotes[0];
    return {
      direction: winnerDirection,
      strategyId: winner?.strategyId ?? strategies[0]?.strategyId,
      metadata: {
        mergePolicy: 'weighted_exit_priority',
        reason: 'weighted_winner',
        scores: { longScore, shortScore, minDirectionalScore },
        votes: votes.map((vote) => ({
          strategyId: vote.strategyId,
          direction: vote.direction,
          priority: vote.priority,
          weight: vote.weight,
        })),
        winner: winner
          ? {
              strategyId: winner.strategyId,
              direction: winner.direction,
              priority: winner.priority,
              weight: winner.weight,
            }
          : null,
      },
    };
  }

  private evaluateStrategy(input: {
    marketType: 'FUTURES' | 'SPOT';
    symbol: string;
    strategy: ActiveBotStrategy;
    decisionOpenTime: number;
  }): StrategyEvaluation {
    const { marketType, symbol, strategy, decisionOpenTime } = input;
    if (!strategy.strategyConfig) {
      return {
        direction: null,
        conditionLines: [],
        indicatorSummary: null,
      };
    }
    const signalRules = parseStrategySignalRules(strategy.strategyConfig);
    if (!signalRules) {
      return {
        direction: null,
        conditionLines: [],
        indicatorSummary: null,
      };
    }

    const candles = this.getSeries(marketType, symbol, strategy.strategyInterval);
    if (!candles || candles.length === 0) {
      return {
        direction: null,
        conditionLines: [],
        indicatorSummary: null,
      };
    }
    const latestIndex = candles.length - 1;
    const decisionIndex = (() => {
      const index = candles.findIndex((candle) => candle.openTime === decisionOpenTime);
      return index >= 0 ? index : latestIndex;
    })();
    const indicatorCache = new Map<string, Array<number | null>>();
    const direction = evaluateStrategySignalAtIndex(signalRules, candles, decisionIndex, indicatorCache);

    const ensureEma = (period: number) => {
      const key = `EMA_${period}`;
      if (!indicatorCache.has(key)) {
        indicatorCache.set(key, computeEmaSeriesFromRuntimeCandles(candles, period));
      }
      return indicatorCache.get(key)!;
    };
    const ensureRsi = (period: number) => {
      const key = `RSI_${period}`;
      if (!indicatorCache.has(key)) {
        indicatorCache.set(key, computeRsiSeriesFromRuntimeCandles(candles, period));
      }
      return indicatorCache.get(key)!;
    };
    const ensureMomentum = (period: number) => {
      const key = `MOMENTUM_${period}`;
      if (!indicatorCache.has(key)) {
        indicatorCache.set(key, computeMomentumSeriesFromRuntimeCandles(candles, period));
      }
      return indicatorCache.get(key)!;
    };

    const conditionLines: RuntimeSignalConditionLine[] = [];
    const indicatorParts: string[] = [];
    const indicatorKeys = new Set<string>();
    const pushRule = (
      scope: 'LONG' | 'SHORT',
      rule: { name: string; condition: string; value: number; params: Record<string, unknown> }
    ) => {
      const indicator = rule.name.toUpperCase();
      if (indicator.includes('EMA')) {
        const fast = clampPeriod(rule.params.fast, 9);
        const slow = clampPeriod(rule.params.slow, 21);
        const fastValue = ensureEma(fast)[decisionIndex];
        const slowValue = ensureEma(slow)[decisionIndex];
        conditionLines.push({
          scope,
          left: `EMA(${fast})`,
          value: formatIndicatorValue(fastValue),
          operator: rule.condition,
          right: `EMA(${slow})=${formatIndicatorValue(slowValue)}`,
        });
        if (!indicatorKeys.has(`EMA(${fast})`)) {
          indicatorKeys.add(`EMA(${fast})`);
          indicatorParts.push(`EMA(${fast})=${formatIndicatorValue(fastValue)}`);
        }
        if (!indicatorKeys.has(`EMA(${slow})`)) {
          indicatorKeys.add(`EMA(${slow})`);
          indicatorParts.push(`EMA(${slow})=${formatIndicatorValue(slowValue)}`);
        }
        return;
      }

      if (indicator.includes('RSI')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
        const value = ensureRsi(period)[decisionIndex];
        conditionLines.push({
          scope,
          left: `RSI(${period})`,
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`RSI(${period})`)) {
          indicatorKeys.add(`RSI(${period})`);
          indicatorParts.push(`RSI(${period})=${formatIndicatorValue(value)}`);
        }
        return;
      }

      if (indicator.includes('MOMENTUM')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
        const value = ensureMomentum(period)[decisionIndex];
        conditionLines.push({
          scope,
          left: `MOMENTUM(${period})`,
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`MOMENTUM(${period})`)) {
          indicatorKeys.add(`MOMENTUM(${period})`);
          indicatorParts.push(`MOMENTUM(${period})=${formatIndicatorValue(value)}`);
        }
        return;
      }

      conditionLines.push({
        scope,
        left: indicator,
        value: 'X',
        operator: rule.condition,
        right: formatRuleTarget(rule.value),
      });
    };

    for (const rule of signalRules.longRules) pushRule('LONG', rule);
    for (const rule of signalRules.shortRules) pushRule('SHORT', rule);

    return {
      direction,
      conditionLines,
      indicatorSummary: indicatorParts.length > 0 ? indicatorParts.join(' | ') : null,
    };
  }

  private async handleTickerEvent(event: StreamTickerEvent) {
    upsertRuntimeTicker(event);
    await this.deps.processPositionAutomation(event);
  }

  private async processPositionAutomationFallbackFromCandle(event: StreamCandleEvent) {
    const latestTicker = getRuntimeTicker(event.symbol);
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
