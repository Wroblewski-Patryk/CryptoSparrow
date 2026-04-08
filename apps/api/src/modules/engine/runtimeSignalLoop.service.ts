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
import { computeRiskBasedOrderQuantity, normalizeWalletRiskPercent } from './positionSizing';
import { resolveRuntimeDcaFundsExhausted, resolveRuntimeReferenceBalance } from './runtimeCapitalContext.service';
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
  walletId: string | null;
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

type FundingRatePoint = {
  timestamp: number;
  fundingRate: number;
};

type OpenInterestPoint = {
  timestamp: number;
  openInterest: number;
};

type OrderBookPoint = {
  timestamp: number;
  imbalance: number;
  spreadBps: number;
  depthRatio: number;
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
        walletId: true,
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
          walletId: bot.walletId ?? null,
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

const resolvePatternParams = (params: Record<string, unknown>): CandlePatternParams => {
  const asFinite = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const dojiBodyToRangeMax = asFinite(params.dojiBodyToRangeMax ?? params.bodyToRangeMax);
  const hammerBodyToRangeMax = asFinite(params.hammerBodyToRangeMax);
  const hammerLowerShadowToBodyMin = asFinite(params.hammerLowerShadowToBodyMin);
  const hammerUpperShadowToBodyMax = asFinite(params.hammerUpperShadowToBodyMax);
  const shootingStarBodyToRangeMax = asFinite(params.shootingStarBodyToRangeMax);
  const shootingStarUpperShadowToBodyMin = asFinite(params.shootingStarUpperShadowToBodyMin);
  const shootingStarLowerShadowToBodyMax = asFinite(params.shootingStarLowerShadowToBodyMax);

  return {
    ...(dojiBodyToRangeMax !== null ? { dojiBodyToRangeMax } : {}),
    ...(hammerBodyToRangeMax !== null ? { hammerBodyToRangeMax } : {}),
    ...(hammerLowerShadowToBodyMin !== null ? { hammerLowerShadowToBodyMin } : {}),
    ...(hammerUpperShadowToBodyMax !== null ? { hammerUpperShadowToBodyMax } : {}),
    ...(shootingStarBodyToRangeMax !== null ? { shootingStarBodyToRangeMax } : {}),
    ...(shootingStarUpperShadowToBodyMin !== null ? { shootingStarUpperShadowToBodyMin } : {}),
    ...(shootingStarLowerShadowToBodyMax !== null ? { shootingStarLowerShadowToBodyMax } : {}),
  };
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
      const exactIndex = candles.findIndex((candle) => candle.openTime === decisionOpenTime);
      if (exactIndex >= 0) return exactIndex;

      for (let index = candles.length - 1; index >= 0; index -= 1) {
        if (candles[index].openTime <= decisionOpenTime) return index;
      }

      return latestIndex;
    })();
    const closes = candles.map((candle) => candle.close);
    const fundingRateSeries = this.resolveFundingRateSeriesForCandles(
      marketType,
      symbol,
      candles,
    );
    const openInterestSeries = this.resolveOpenInterestSeriesForCandles(
      marketType,
      symbol,
      candles,
    );
    const orderBookSeries = this.resolveOrderBookSeriesForCandles(
      marketType,
      symbol,
      candles,
    );
    const indicatorCache = new Map<string, Array<number | null>>();
    const direction = evaluateStrategySignalAtIndex(
      signalRules,
      candles,
      decisionIndex,
      indicatorCache,
      fundingRateSeries || openInterestSeries || orderBookSeries
        ? {
            derivatives: {
              ...(fundingRateSeries ? { fundingRate: fundingRateSeries } : {}),
              ...(openInterestSeries ? { openInterest: openInterestSeries } : {}),
              ...(orderBookSeries
                ? {
                    orderBookImbalance: orderBookSeries.orderBookImbalance,
                    orderBookSpreadBps: orderBookSeries.orderBookSpreadBps,
                    orderBookDepthRatio: orderBookSeries.orderBookDepthRatio,
                  }
                : {}),
            },
          }
        : undefined,
    );

    const ensureEma = (period: number) => {
      const key = `EMA_${period}`;
      if (!indicatorCache.has(key)) {
        indicatorCache.set(key, computeEmaSeriesFromCloses(closes, period));
      }
      return indicatorCache.get(key)!;
    };
    const ensureRsi = (period: number) => {
      const key = `RSI_${period}`;
      if (!indicatorCache.has(key)) {
        indicatorCache.set(key, computeRsiSeriesFromCloses(closes, period));
      }
      return indicatorCache.get(key)!;
    };
    const ensureSma = (period: number) => {
      const key = `SMA_${period}`;
      if (!indicatorCache.has(key)) {
        indicatorCache.set(key, computeSmaSeriesFromCloses(closes, period));
      }
      return indicatorCache.get(key)!;
    };
    const ensureMomentum = (period: number) => {
      const key = `MOMENTUM_${period}`;
      if (!indicatorCache.has(key)) {
        indicatorCache.set(key, computeMomentumSeriesFromCloses(closes, period));
      }
      return indicatorCache.get(key)!;
    };
    const ensureFundingRate = () => {
      const key = 'FUNDING_RATE_RAW';
      if (!indicatorCache.has(key)) {
        const normalized = candles.map((_, index) => {
          const value = fundingRateSeries?.[index];
          return typeof value === 'number' && Number.isFinite(value) ? value : null;
        });
        indicatorCache.set(key, normalized);
      }
      return indicatorCache.get(key)!;
    };
    const ensureFundingRateZScore = (period: number) => {
      const key = `FUNDING_RATE_ZSCORE_${period}`;
      if (!indicatorCache.has(key)) {
        indicatorCache.set(
          key,
          computeRollingZScoreSeriesFromNullableValues(ensureFundingRate(), period),
        );
      }
      return indicatorCache.get(key)!;
    };
    const ensureOpenInterest = () => {
      const key = 'OPEN_INTEREST_RAW';
      if (!indicatorCache.has(key)) {
        const normalized = candles.map((_, index) => {
          const value = openInterestSeries?.[index];
          return typeof value === 'number' && Number.isFinite(value) ? value : null;
        });
        indicatorCache.set(key, normalized);
      }
      return indicatorCache.get(key)!;
    };
    const ensureOpenInterestDelta = () => {
      const key = 'OPEN_INTEREST_DELTA';
      if (!indicatorCache.has(key)) {
        const delta = ensureOpenInterest().map((value, index, source) => {
          if (index === 0 || typeof value !== 'number') return null;
          const previous = source[index - 1];
          if (typeof previous !== 'number') return null;
          return value - previous;
        });
        indicatorCache.set(key, delta);
      }
      return indicatorCache.get(key)!;
    };
    const ensureOpenInterestMa = (period: number) => {
      const key = `OPEN_INTEREST_MA_${period}`;
      if (!indicatorCache.has(key)) {
        indicatorCache.set(
          key,
          computeSmaSeriesFromNullableValues(ensureOpenInterest(), period),
        );
      }
      return indicatorCache.get(key)!;
    };
    const ensureOpenInterestZScore = (period: number) => {
      const key = `OPEN_INTEREST_ZSCORE_${period}`;
      if (!indicatorCache.has(key)) {
        indicatorCache.set(
          key,
          computeRollingZScoreSeriesFromNullableValues(ensureOpenInterest(), period),
        );
      }
      return indicatorCache.get(key)!;
    };
    const ensureOrderBookImbalance = () => {
      const key = 'ORDER_BOOK_IMBALANCE';
      if (!indicatorCache.has(key)) {
        const normalized = candles.map((_, index) => {
          const value = orderBookSeries?.orderBookImbalance[index];
          return typeof value === 'number' && Number.isFinite(value) ? value : null;
        });
        indicatorCache.set(key, normalized);
      }
      return indicatorCache.get(key)!;
    };
    const ensureOrderBookSpreadBps = () => {
      const key = 'ORDER_BOOK_SPREAD_BPS';
      if (!indicatorCache.has(key)) {
        const normalized = candles.map((_, index) => {
          const value = orderBookSeries?.orderBookSpreadBps[index];
          return typeof value === 'number' && Number.isFinite(value) ? value : null;
        });
        indicatorCache.set(key, normalized);
      }
      return indicatorCache.get(key)!;
    };
    const ensureOrderBookDepthRatio = () => {
      const key = 'ORDER_BOOK_DEPTH_RATIO';
      if (!indicatorCache.has(key)) {
        const normalized = candles.map((_, index) => {
          const value = orderBookSeries?.orderBookDepthRatio[index];
          return typeof value === 'number' && Number.isFinite(value) ? value : null;
        });
        indicatorCache.set(key, normalized);
      }
      return indicatorCache.get(key)!;
    };
    const ensureRoc = (period: number) => {
      const key = `ROC_${period}`;
      if (!indicatorCache.has(key)) {
        indicatorCache.set(key, computeRocSeriesFromCloses(closes, period));
      }
      return indicatorCache.get(key)!;
    };
    const ensureAtr = (period: number) => {
      const key = `ATR_${period}`;
      if (!indicatorCache.has(key)) {
        const highs = candles.map((candle) => candle.high);
        const lows = candles.map((candle) => candle.low);
        indicatorCache.set(key, computeAtrSeriesFromCandles(highs, lows, closes, period));
      }
      return indicatorCache.get(key)!;
    };
    const ensureCci = (period: number) => {
      const key = `CCI_${period}`;
      if (!indicatorCache.has(key)) {
        const highs = candles.map((candle) => candle.high);
        const lows = candles.map((candle) => candle.low);
        indicatorCache.set(key, computeCciSeriesFromCandles(highs, lows, closes, period));
      }
      return indicatorCache.get(key)!;
    };
    const ensureAdx = (period: number) => {
      const baseKey = `ADX_${period}`;
      const adxKey = `${baseKey}_ADX`;
      const plusKey = `${baseKey}_DI_PLUS`;
      const minusKey = `${baseKey}_DI_MINUS`;
      if (!indicatorCache.has(adxKey) || !indicatorCache.has(plusKey) || !indicatorCache.has(minusKey)) {
        const highs = candles.map((candle) => candle.high);
        const lows = candles.map((candle) => candle.low);
        const adx = computeAdxSeriesFromCandles(highs, lows, closes, period);
        indicatorCache.set(adxKey, adx.adx);
        indicatorCache.set(plusKey, adx.plusDi);
        indicatorCache.set(minusKey, adx.minusDi);
      }
      return {
        adx: indicatorCache.get(adxKey)!,
        plusDi: indicatorCache.get(plusKey)!,
        minusDi: indicatorCache.get(minusKey)!,
      };
    };
    const ensureStochastic = (period: number, smoothK: number, smoothD: number) => {
      const baseKey = `STOCHASTIC_${period}_${smoothK}_${smoothD}`;
      const kKey = `${baseKey}_K`;
      const dKey = `${baseKey}_D`;
      if (!indicatorCache.has(kKey) || !indicatorCache.has(dKey)) {
        const highs = candles.map((candle) => candle.high);
        const lows = candles.map((candle) => candle.low);
        const stochastic = computeStochasticSeriesFromCandles(highs, lows, closes, period, smoothK, smoothD);
        indicatorCache.set(kKey, stochastic.k);
        indicatorCache.set(dKey, stochastic.d);
      }
      return {
        k: indicatorCache.get(kKey)!,
        d: indicatorCache.get(dKey)!,
      };
    };
    const ensureMacd = (fast: number, slow: number, signal: number) => {
      const baseKey = `MACD_${fast}_${slow}_${signal}`;
      const lineKey = `${baseKey}_LINE`;
      const signalKey = `${baseKey}_SIGNAL`;
      const histogramKey = `${baseKey}_HISTOGRAM`;

      if (!indicatorCache.has(lineKey) || !indicatorCache.has(signalKey) || !indicatorCache.has(histogramKey)) {
        const macd = computeMacdSeriesFromCloses(closes, fast, slow, signal);
        indicatorCache.set(lineKey, macd.line);
        indicatorCache.set(signalKey, macd.signal);
        indicatorCache.set(histogramKey, macd.histogram);
      }

      return {
        line: indicatorCache.get(lineKey)!,
        signal: indicatorCache.get(signalKey)!,
        histogram: indicatorCache.get(histogramKey)!,
      };
    };
    const ensureStochRsi = (period: number, stochPeriod: number, smoothK: number, smoothD: number) => {
      const baseKey = `STOCHRSI_${period}_${stochPeriod}_${smoothK}_${smoothD}`;
      const kKey = `${baseKey}_K`;
      const dKey = `${baseKey}_D`;

      if (!indicatorCache.has(kKey) || !indicatorCache.has(dKey)) {
        const stochRsi = computeStochRsiSeriesFromCloses(closes, period, stochPeriod, smoothK, smoothD);
        indicatorCache.set(kKey, stochRsi.k);
        indicatorCache.set(dKey, stochRsi.d);
      }

      return {
        k: indicatorCache.get(kKey)!,
        d: indicatorCache.get(dKey)!,
      };
    };
    const ensureBollinger = (period: number, stdDev: number) => {
      const baseKey = `BOLLINGER_${period}_${stdDev}`;
      const upperKey = `${baseKey}_UPPER`;
      const middleKey = `${baseKey}_MIDDLE`;
      const lowerKey = `${baseKey}_LOWER`;
      const bandwidthKey = `${baseKey}_BANDWIDTH`;
      const percentBKey = `${baseKey}_PERCENT_B`;

      if (
        !indicatorCache.has(upperKey) ||
        !indicatorCache.has(middleKey) ||
        !indicatorCache.has(lowerKey) ||
        !indicatorCache.has(bandwidthKey) ||
        !indicatorCache.has(percentBKey)
      ) {
        const bollinger = computeBollingerSeriesFromCloses(closes, period, stdDev);
        indicatorCache.set(upperKey, bollinger.upper);
        indicatorCache.set(middleKey, bollinger.middle);
        indicatorCache.set(lowerKey, bollinger.lower);
        indicatorCache.set(bandwidthKey, bollinger.bandwidth);
        indicatorCache.set(percentBKey, bollinger.percentB);
      }

      return {
        upper: indicatorCache.get(upperKey)!,
        middle: indicatorCache.get(middleKey)!,
        lower: indicatorCache.get(lowerKey)!,
        bandwidth: indicatorCache.get(bandwidthKey)!,
        percentB: indicatorCache.get(percentBKey)!,
      };
    };
    const ensureDonchian = (period: number) => {
      const baseKey = `DONCHIAN_${period}`;
      const upperKey = `${baseKey}_UPPER`;
      const middleKey = `${baseKey}_MIDDLE`;
      const lowerKey = `${baseKey}_LOWER`;
      if (!indicatorCache.has(upperKey) || !indicatorCache.has(middleKey) || !indicatorCache.has(lowerKey)) {
        const highs = candles.map((candle) => candle.high);
        const lows = candles.map((candle) => candle.low);
        const donchian = computeDonchianSeriesFromCandles(highs, lows, period);
        indicatorCache.set(upperKey, donchian.upper);
        indicatorCache.set(middleKey, donchian.middle);
        indicatorCache.set(lowerKey, donchian.lower);
      }
      return {
        upper: indicatorCache.get(upperKey)!,
        middle: indicatorCache.get(middleKey)!,
        lower: indicatorCache.get(lowerKey)!,
      };
    };
    const ensurePattern = (patternName: string, rawParams: Record<string, unknown>) => {
      const pattern = resolveCandlePatternName(patternName);
      if (!pattern) return null;
      const patternParams = resolvePatternParams(rawParams);
      const key = `PATTERN_${pattern}_${JSON.stringify(patternParams)}`;
      if (!indicatorCache.has(key)) {
        const patternCandles = candles.map((candle) => ({
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        }));
        const values = computeCandlePatternSeries(patternCandles, pattern, patternParams).map((value) => (value ? 1 : 0));
        indicatorCache.set(key, values);
      }
      return indicatorCache.get(key) ?? null;
    };

    const conditionLines: RuntimeSignalConditionLine[] = [];
    const indicatorParts: string[] = [];
    const indicatorKeys = new Set<string>();
    const pushRule = (
      scope: 'LONG' | 'SHORT',
      rule: { name: string; condition: string; value: number; params: Record<string, unknown> }
    ) => {
      const indicator = rule.name.toUpperCase();
      if (indicator.includes('FUNDING_RATE_ZSCORE')) {
        const period = clampPeriod(
          rule.params.zScorePeriod ?? rule.params.period ?? rule.params.length,
          20,
        );
        const value = ensureFundingRateZScore(period)[decisionIndex];
        conditionLines.push({
          scope,
          left: `FUNDING_RATE_ZSCORE(${period})`,
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`FUNDING_RATE_ZSCORE(${period})`)) {
          indicatorKeys.add(`FUNDING_RATE_ZSCORE(${period})`);
          indicatorParts.push(
            `FUNDING_RATE_ZSCORE(${period})=${formatIndicatorValue(value)}`,
          );
        }
        return;
      }

      if (indicator.includes('FUNDING_RATE')) {
        const value = ensureFundingRate()[decisionIndex];
        conditionLines.push({
          scope,
          left: 'FUNDING_RATE',
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has('FUNDING_RATE')) {
          indicatorKeys.add('FUNDING_RATE');
          indicatorParts.push(`FUNDING_RATE=${formatIndicatorValue(value)}`);
        }
        return;
      }

      if (indicator.includes('OPEN_INTEREST_ZSCORE')) {
        const period = clampPeriod(
          rule.params.zScorePeriod ?? rule.params.period ?? rule.params.length,
          20,
        );
        const value = ensureOpenInterestZScore(period)[decisionIndex];
        conditionLines.push({
          scope,
          left: `OPEN_INTEREST_ZSCORE(${period})`,
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`OPEN_INTEREST_ZSCORE(${period})`)) {
          indicatorKeys.add(`OPEN_INTEREST_ZSCORE(${period})`);
          indicatorParts.push(
            `OPEN_INTEREST_ZSCORE(${period})=${formatIndicatorValue(value)}`,
          );
        }
        return;
      }

      if (indicator.includes('OPEN_INTEREST_MA')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 20);
        const value = ensureOpenInterestMa(period)[decisionIndex];
        conditionLines.push({
          scope,
          left: `OPEN_INTEREST_MA(${period})`,
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`OPEN_INTEREST_MA(${period})`)) {
          indicatorKeys.add(`OPEN_INTEREST_MA(${period})`);
          indicatorParts.push(
            `OPEN_INTEREST_MA(${period})=${formatIndicatorValue(value)}`,
          );
        }
        return;
      }

      if (indicator.includes('OPEN_INTEREST_DELTA')) {
        const value = ensureOpenInterestDelta()[decisionIndex];
        conditionLines.push({
          scope,
          left: 'OPEN_INTEREST_DELTA',
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has('OPEN_INTEREST_DELTA')) {
          indicatorKeys.add('OPEN_INTEREST_DELTA');
          indicatorParts.push(
            `OPEN_INTEREST_DELTA=${formatIndicatorValue(value)}`,
          );
        }
        return;
      }

      if (indicator.includes('OPEN_INTEREST')) {
        const value = ensureOpenInterest()[decisionIndex];
        conditionLines.push({
          scope,
          left: 'OPEN_INTEREST',
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has('OPEN_INTEREST')) {
          indicatorKeys.add('OPEN_INTEREST');
          indicatorParts.push(`OPEN_INTEREST=${formatIndicatorValue(value)}`);
        }
        return;
      }

      if (indicator.includes('ORDER_BOOK_IMBALANCE')) {
        const value = ensureOrderBookImbalance()[decisionIndex];
        conditionLines.push({
          scope,
          left: 'ORDER_BOOK_IMBALANCE',
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has('ORDER_BOOK_IMBALANCE')) {
          indicatorKeys.add('ORDER_BOOK_IMBALANCE');
          indicatorParts.push(
            `ORDER_BOOK_IMBALANCE=${formatIndicatorValue(value)}`,
          );
        }
        return;
      }

      if (indicator.includes('ORDER_BOOK_SPREAD_BPS')) {
        const value = ensureOrderBookSpreadBps()[decisionIndex];
        conditionLines.push({
          scope,
          left: 'ORDER_BOOK_SPREAD_BPS',
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has('ORDER_BOOK_SPREAD_BPS')) {
          indicatorKeys.add('ORDER_BOOK_SPREAD_BPS');
          indicatorParts.push(
            `ORDER_BOOK_SPREAD_BPS=${formatIndicatorValue(value)}`,
          );
        }
        return;
      }

      if (indicator.includes('ORDER_BOOK_DEPTH_RATIO')) {
        const value = ensureOrderBookDepthRatio()[decisionIndex];
        conditionLines.push({
          scope,
          left: 'ORDER_BOOK_DEPTH_RATIO',
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has('ORDER_BOOK_DEPTH_RATIO')) {
          indicatorKeys.add('ORDER_BOOK_DEPTH_RATIO');
          indicatorParts.push(
            `ORDER_BOOK_DEPTH_RATIO=${formatIndicatorValue(value)}`,
          );
        }
        return;
      }

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

      if (indicator.includes('RSI') && !indicator.includes('STOCHRSI')) {
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

      if (indicator.includes('SMA')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
        const value = ensureSma(period)[decisionIndex];
        conditionLines.push({
          scope,
          left: `SMA(${period})`,
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`SMA(${period})`)) {
          indicatorKeys.add(`SMA(${period})`);
          indicatorParts.push(`SMA(${period})=${formatIndicatorValue(value)}`);
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

      if (indicator.includes('ROC')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
        const value = ensureRoc(period)[decisionIndex];
        conditionLines.push({
          scope,
          left: `ROC(${period})`,
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`ROC(${period})`)) {
          indicatorKeys.add(`ROC(${period})`);
          indicatorParts.push(`ROC(${period})=${formatIndicatorValue(value)}`);
        }
        return;
      }

      if (indicator.includes('ATR')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
        const value = ensureAtr(period)[decisionIndex];
        conditionLines.push({
          scope,
          left: `ATR(${period})`,
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`ATR(${period})`)) {
          indicatorKeys.add(`ATR(${period})`);
          indicatorParts.push(`ATR(${period})=${formatIndicatorValue(value)}`);
        }
        return;
      }

      if (indicator.includes('CCI')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 20);
        const value = ensureCci(period)[decisionIndex];
        conditionLines.push({
          scope,
          left: `CCI(${period})`,
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`CCI(${period})`)) {
          indicatorKeys.add(`CCI(${period})`);
          indicatorParts.push(`CCI(${period})=${formatIndicatorValue(value)}`);
        }
        return;
      }

      if (indicator.includes('ADX')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
        const adx = ensureAdx(period);
        const adxValue = adx.adx[decisionIndex];
        const plusValue = adx.plusDi[decisionIndex];
        const minusValue = adx.minusDi[decisionIndex];
        conditionLines.push({
          scope,
          left: `ADX(${period})`,
          value: formatIndicatorValue(adxValue),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`ADX(${period})`)) {
          indicatorKeys.add(`ADX(${period})`);
          indicatorParts.push(`ADX(${period})=${formatIndicatorValue(adxValue)}`);
        }
        if (!indicatorKeys.has(`DI_PLUS(${period})`)) {
          indicatorKeys.add(`DI_PLUS(${period})`);
          indicatorParts.push(`DI_PLUS(${period})=${formatIndicatorValue(plusValue)}`);
        }
        if (!indicatorKeys.has(`DI_MINUS(${period})`)) {
          indicatorKeys.add(`DI_MINUS(${period})`);
          indicatorParts.push(`DI_MINUS(${period})=${formatIndicatorValue(minusValue)}`);
        }
        return;
      }

      if (indicator.includes('STOCHASTIC')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 14);
        const smoothK = clampPeriod(rule.params.smoothK, 3);
        const smoothD = clampPeriod(rule.params.smoothD, 3);
        const stochastic = ensureStochastic(period, smoothK, smoothD);
        const kValue = stochastic.k[decisionIndex];
        const dValue = stochastic.d[decisionIndex];
        conditionLines.push({
          scope,
          left: `STOCHASTIC_K(${period},${smoothK},${smoothD})`,
          value: formatIndicatorValue(kValue),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`STOCHASTIC_K(${period},${smoothK},${smoothD})`)) {
          indicatorKeys.add(`STOCHASTIC_K(${period},${smoothK},${smoothD})`);
          indicatorParts.push(`STOCHASTIC_K(${period},${smoothK},${smoothD})=${formatIndicatorValue(kValue)}`);
        }
        if (!indicatorKeys.has(`STOCHASTIC_D(${period},${smoothK},${smoothD})`)) {
          indicatorKeys.add(`STOCHASTIC_D(${period},${smoothK},${smoothD})`);
          indicatorParts.push(`STOCHASTIC_D(${period},${smoothK},${smoothD})=${formatIndicatorValue(dValue)}`);
        }
        return;
      }

      if (indicator.includes('STOCHRSI')) {
        const period = clampPeriod(rule.params.period ?? rule.params.rsiPeriod, 14);
        const stochPeriod = clampPeriod(rule.params.stochPeriod ?? period, 14);
        const smoothK = clampPeriod(rule.params.smoothK, 3);
        const smoothD = clampPeriod(rule.params.smoothD, 3);
        const stochRsi = ensureStochRsi(period, stochPeriod, smoothK, smoothD);
        const kValue = stochRsi.k[decisionIndex];
        const dValue = stochRsi.d[decisionIndex];

        conditionLines.push({
          scope,
          left: `STOCHRSI(${period},${stochPeriod},${smoothK},${smoothD})`,
          value: formatIndicatorValue(kValue),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`STOCHRSI_K(${period},${stochPeriod},${smoothK},${smoothD})`)) {
          indicatorKeys.add(`STOCHRSI_K(${period},${stochPeriod},${smoothK},${smoothD})`);
          indicatorParts.push(
            `STOCHRSI_K(${period},${stochPeriod},${smoothK},${smoothD})=${formatIndicatorValue(kValue)}`,
          );
        }
        if (!indicatorKeys.has(`STOCHRSI_D(${period},${stochPeriod},${smoothK},${smoothD})`)) {
          indicatorKeys.add(`STOCHRSI_D(${period},${stochPeriod},${smoothK},${smoothD})`);
          indicatorParts.push(
            `STOCHRSI_D(${period},${stochPeriod},${smoothK},${smoothD})=${formatIndicatorValue(dValue)}`,
          );
        }
        return;
      }

      if (indicator.includes('BOLLINGER')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 20);
        const stdDevCandidate = Number(rule.params.stdDev ?? rule.params.deviation);
        const stdDev = Number.isFinite(stdDevCandidate) ? stdDevCandidate : 2;
        const bollinger = ensureBollinger(period, stdDev);
        const percentBValue = bollinger.percentB[decisionIndex];
        const bandwidthValue = bollinger.bandwidth[decisionIndex];

        conditionLines.push({
          scope,
          left: `BOLLINGER_PERCENT_B(${period},${stdDev})`,
          value: formatIndicatorValue(percentBValue),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`BOLLINGER_UPPER(${period},${stdDev})`)) {
          indicatorKeys.add(`BOLLINGER_UPPER(${period},${stdDev})`);
          indicatorParts.push(`BOLLINGER_UPPER(${period},${stdDev})=${formatIndicatorValue(bollinger.upper[decisionIndex])}`);
        }
        if (!indicatorKeys.has(`BOLLINGER_MIDDLE(${period},${stdDev})`)) {
          indicatorKeys.add(`BOLLINGER_MIDDLE(${period},${stdDev})`);
          indicatorParts.push(
            `BOLLINGER_MIDDLE(${period},${stdDev})=${formatIndicatorValue(bollinger.middle[decisionIndex])}`,
          );
        }
        if (!indicatorKeys.has(`BOLLINGER_LOWER(${period},${stdDev})`)) {
          indicatorKeys.add(`BOLLINGER_LOWER(${period},${stdDev})`);
          indicatorParts.push(`BOLLINGER_LOWER(${period},${stdDev})=${formatIndicatorValue(bollinger.lower[decisionIndex])}`);
        }
        if (!indicatorKeys.has(`BOLLINGER_BANDWIDTH(${period},${stdDev})`)) {
          indicatorKeys.add(`BOLLINGER_BANDWIDTH(${period},${stdDev})`);
          indicatorParts.push(`BOLLINGER_BANDWIDTH(${period},${stdDev})=${formatIndicatorValue(bandwidthValue)}`);
        }
        if (!indicatorKeys.has(`BOLLINGER_PERCENT_B(${period},${stdDev})`)) {
          indicatorKeys.add(`BOLLINGER_PERCENT_B(${period},${stdDev})`);
          indicatorParts.push(`BOLLINGER_PERCENT_B(${period},${stdDev})=${formatIndicatorValue(percentBValue)}`);
        }
        return;
      }

      if (indicator.includes('DONCHIAN')) {
        const period = clampPeriod(rule.params.period ?? rule.params.length, 20);
        const donchian = ensureDonchian(period);
        const middleValue = donchian.middle[decisionIndex];

        conditionLines.push({
          scope,
          left: `DONCHIAN_MIDDLE(${period})`,
          value: formatIndicatorValue(middleValue),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(`DONCHIAN_UPPER(${period})`)) {
          indicatorKeys.add(`DONCHIAN_UPPER(${period})`);
          indicatorParts.push(`DONCHIAN_UPPER(${period})=${formatIndicatorValue(donchian.upper[decisionIndex])}`);
        }
        if (!indicatorKeys.has(`DONCHIAN_MIDDLE(${period})`)) {
          indicatorKeys.add(`DONCHIAN_MIDDLE(${period})`);
          indicatorParts.push(`DONCHIAN_MIDDLE(${period})=${formatIndicatorValue(middleValue)}`);
        }
        if (!indicatorKeys.has(`DONCHIAN_LOWER(${period})`)) {
          indicatorKeys.add(`DONCHIAN_LOWER(${period})`);
          indicatorParts.push(`DONCHIAN_LOWER(${period})=${formatIndicatorValue(donchian.lower[decisionIndex])}`);
        }
        return;
      }

      const pattern = resolveCandlePatternName(indicator);
      if (
        pattern &&
        (
          pattern === 'BULLISH_ENGULFING' ||
          pattern === 'BEARISH_ENGULFING' ||
          pattern === 'HAMMER' ||
          pattern === 'SHOOTING_STAR' ||
          pattern === 'DOJI' ||
          pattern === 'MORNING_STAR' ||
          pattern === 'EVENING_STAR' ||
          pattern === 'INSIDE_BAR' ||
          pattern === 'OUTSIDE_BAR'
        )
      ) {
        const patternValues = ensurePattern(indicator, rule.params);
        const value = patternValues ? patternValues[decisionIndex] : null;
        conditionLines.push({
          scope,
          left: pattern,
          value: formatIndicatorValue(value),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });
        if (!indicatorKeys.has(pattern)) {
          indicatorKeys.add(pattern);
          indicatorParts.push(`${pattern}=${formatIndicatorValue(value)}`);
        }
        return;
      }

      if (indicator.includes('MACD')) {
        const fast = clampPeriod(rule.params.fast, 12);
        const slow = clampPeriod(rule.params.slow, 26);
        const signal = clampPeriod(rule.params.signal, 9);
        const macd = ensureMacd(fast, slow, signal);
        const lineValue = macd.line[decisionIndex];
        const signalValue = macd.signal[decisionIndex];
        const histogramValue = macd.histogram[decisionIndex];

        conditionLines.push({
          scope,
          left: `MACD(${fast},${slow},${signal})`,
          value: formatIndicatorValue(lineValue),
          operator: rule.condition,
          right: formatRuleTarget(rule.value),
        });

        if (!indicatorKeys.has(`MACD(${fast},${slow},${signal})`)) {
          indicatorKeys.add(`MACD(${fast},${slow},${signal})`);
          indicatorParts.push(`MACD(${fast},${slow},${signal})=${formatIndicatorValue(lineValue)}`);
        }
        if (!indicatorKeys.has(`MACD_SIGNAL(${fast},${slow},${signal})`)) {
          indicatorKeys.add(`MACD_SIGNAL(${fast},${slow},${signal})`);
          indicatorParts.push(`MACD_SIGNAL(${fast},${slow},${signal})=${formatIndicatorValue(signalValue)}`);
        }
        if (!indicatorKeys.has(`MACD_HIST(${fast},${slow},${signal})`)) {
          indicatorKeys.add(`MACD_HIST(${fast},${slow},${signal})`);
          indicatorParts.push(`MACD_HIST(${fast},${slow},${signal})=${formatIndicatorValue(histogramValue)}`);
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
