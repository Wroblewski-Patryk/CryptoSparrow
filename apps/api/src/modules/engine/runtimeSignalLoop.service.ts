import { Prisma, SignalDirection } from '@prisma/client';
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
import { upsertRuntimeTicker } from './runtimeTickerStore';

type ActiveBotStrategy = {
  strategyId: string;
  strategyInterval: string | null;
  strategyConfig: Record<string, unknown> | null;
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
  marketType: 'FUTURES' | 'SPOT';
  marketGroups: ActiveBotMarketGroup[];
};

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
};

const runtimeLongThreshold = Number.parseFloat(process.env.RUNTIME_SIGNAL_LONG_THRESHOLD ?? '1');
const runtimeShortThreshold = Number.parseFloat(process.env.RUNTIME_SIGNAL_SHORT_THRESHOLD ?? '-1');
const runtimeExitBand = Number.parseFloat(process.env.RUNTIME_SIGNAL_EXIT_BAND ?? '0.2');
const runtimeSignalQuantity = Number.parseFloat(process.env.RUNTIME_SIGNAL_QUANTITY ?? '0.01');
const runtimeDirectionCooldownMs = Number.parseInt(process.env.RUNTIME_SIGNAL_COOLDOWN_MS ?? '30000', 10);
const runtimeManualPositionMode = (process.env.RUNTIME_MANUAL_POSITION_MODE ?? 'LIVE') as 'PAPER' | 'LIVE';
const maxCandlesPerSeries = Number.parseInt(process.env.RUNTIME_SIGNAL_CANDLE_BUFFER ?? '500', 10);
const minDirectionalScore = Number.parseFloat(process.env.RUNTIME_SIGNAL_MIN_DIRECTIONAL_SCORE ?? '1');
const defaultGroupMaxOpenPositions = Number.parseInt(
  process.env.RUNTIME_GROUP_MAX_OPEN_POSITIONS_DEFAULT ?? '1',
  10
);

type RuntimeCandle = {
  openTime: number;
  close: number;
};

type StrategyIndicator = {
  name: string;
  condition?: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value?: number;
  params?: Record<string, unknown>;
};

type StrategyVote = {
  strategyId: string;
  direction: SignalDirection;
  priority: number;
  weight: number;
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
                  },
                },
              },
            },
          },
          orderBy: [{ executionOrder: 'asc' }, { createdAt: 'asc' }],
        },
        botStrategies: {
          where: { isEnabled: true },
          orderBy: { createdAt: 'desc' },
          select: {
            symbolGroupId: true,
            strategyId: true,
            symbolGroup: {
              select: {
                symbols: true,
              },
            },
            strategy: {
              select: {
                interval: true,
                config: true,
              },
            },
          },
        },
      },
    });
    return bots.map((bot) => {
      const marketGroupsFromNewModel: ActiveBotMarketGroup[] = bot.botMarketGroups.map((group) => ({
        id: group.id,
        symbolGroupId: group.symbolGroupId,
        executionOrder: group.executionOrder,
        maxOpenPositions: group.maxOpenPositions,
        symbols: group.symbolGroup.symbols ?? [],
        strategies: group.strategyLinks.map((link) => ({
          strategyId: link.strategyId,
          strategyInterval: link.strategy.interval,
          strategyConfig: (link.strategy.config as Record<string, unknown> | undefined) ?? null,
          priority: link.priority,
          weight: link.weight,
        })),
      }));

      const marketGroupsFromLegacyModel: ActiveBotMarketGroup[] = bot.botStrategies.map((item) => ({
        id: `legacy:${item.symbolGroupId}`,
        symbolGroupId: item.symbolGroupId,
        executionOrder: 10_000,
        maxOpenPositions: defaultGroupMaxOpenPositions,
        symbols: item.symbolGroup.symbols ?? [],
        strategies: [
          {
            strategyId: item.strategyId,
            strategyInterval: item.strategy.interval,
            strategyConfig: (item.strategy.config as Record<string, unknown> | undefined) ?? null,
            priority: 100,
            weight: 1,
          },
        ],
      }));

      const dedupBySymbolGroup = new Map<string, ActiveBotMarketGroup>();
      for (const group of [...marketGroupsFromNewModel, ...marketGroupsFromLegacyModel]) {
        if (!dedupBySymbolGroup.has(group.symbolGroupId)) {
          dedupBySymbolGroup.set(group.symbolGroupId, group);
        }
      }

      return {
        id: bot.id,
        userId: bot.userId,
        mode: bot.mode as 'PAPER' | 'LIVE',
        marketType: bot.marketType,
        marketGroups: [...dedupBySymbolGroup.values()].sort(
          (left, right) => left.executionOrder - right.executionOrder
        ),
      };
    });
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
};

const toDirection = (ticker: StreamTickerEvent): SignalDirection | null => {
  if (ticker.priceChangePercent24h >= runtimeLongThreshold) return 'LONG';
  if (ticker.priceChangePercent24h <= runtimeShortThreshold) return 'SHORT';
  if (Math.abs(ticker.priceChangePercent24h) <= runtimeExitBand) return 'EXIT';
  return null;
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

const compare = (
  left: number,
  operator: StrategyIndicator['condition'] = '>',
  right: number
) => {
  if (operator === '>') return left > right;
  if (operator === '>=') return left >= right;
  if (operator === '<') return left < right;
  if (operator === '<=') return left <= right;
  if (operator === '==') return left === right;
  return left !== right;
};

const toIndicator = (value: unknown): StrategyIndicator | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as {
    name?: unknown;
    condition?: unknown;
    value?: unknown;
    params?: unknown;
  };
  if (typeof candidate.name !== 'string') return null;
  return {
    name: candidate.name.trim().toUpperCase(),
    condition:
      candidate.condition === '>' ||
      candidate.condition === '<' ||
      candidate.condition === '>=' ||
      candidate.condition === '<=' ||
      candidate.condition === '==' ||
      candidate.condition === '!='
        ? candidate.condition
        : undefined,
    value: typeof candidate.value === 'number' ? candidate.value : undefined,
    params:
      candidate.params && typeof candidate.params === 'object'
        ? (candidate.params as Record<string, unknown>)
        : undefined,
  };
};

const computeEma = (candles: RuntimeCandle[], period: number) => {
  if (candles.length < period) return null;
  const alpha = 2 / (period + 1);
  let ema = candles[0].close;
  for (let index = 1; index < candles.length; index += 1) {
    ema = candles[index].close * alpha + ema * (1 - alpha);
  }
  return ema;
};

const computeRsi = (candles: RuntimeCandle[], period: number) => {
  if (candles.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const diff = candles[index].close - candles[index - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let index = period + 1; index < candles.length; index += 1) {
    const diff = candles[index].close - candles[index - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
};

export class RuntimeSignalLoop {
  private unsubscribe: (() => Promise<void>) | null = null;
  private readonly recentlyProcessed = new Map<string, { direction: SignalDirection; at: number }>();
  private readonly candleSeries = new Map<string, RuntimeCandle[]>();

  constructor(private readonly deps: RuntimeSignalLoopDeps = defaultDeps) {}

  isRunning() {
    return this.unsubscribe !== null;
  }

  async start() {
    if (this.unsubscribe) return;
    this.unsubscribe = await this.deps.subscribe(async (event) => {
      await this.handleEvent(event);
    });
  }

  async stop() {
    if (!this.unsubscribe) return;
    await this.unsubscribe();
    this.unsubscribe = null;
  }

  async processTickerEvent(event: StreamTickerEvent) {
    await this.handleTickerEvent(event);
  }

  private async handleEvent(event: MarketStreamEvent) {
    if (event.type === 'candle') {
      this.handleCandleEvent(event);
      return;
    }
    if (event.type === 'ticker') {
      await this.handleTickerEvent(event);
    }
  }

  private handleCandleEvent(event: StreamCandleEvent) {
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

  private evaluateIndicator(indicator: StrategyIndicator, candles: RuntimeCandle[]) {
    if (indicator.name.includes('EMA')) {
      const fastCandidate = Number(indicator.params?.fast ?? 9);
      const slowCandidate = Number(indicator.params?.slow ?? 21);
      const fast = Number.isFinite(fastCandidate) ? Math.max(2, Math.floor(fastCandidate)) : 9;
      const slow = Number.isFinite(slowCandidate) ? Math.max(2, Math.floor(slowCandidate)) : 21;
      const fastValue = computeEma(candles, fast);
      const slowValue = computeEma(candles, slow);
      if (fastValue === null || slowValue === null) return false;
      return compare(fastValue, indicator.condition ?? '>', slowValue);
    }

    if (indicator.name.includes('RSI')) {
      const periodCandidate = Number(indicator.params?.period ?? 14);
      const period = Number.isFinite(periodCandidate) ? Math.max(2, Math.floor(periodCandidate)) : 14;
      const rsi = computeRsi(candles, period);
      if (rsi === null || typeof indicator.value !== 'number') return false;
      return compare(rsi, indicator.condition ?? '>', indicator.value);
    }

    return false;
  }

  private evaluateIndicators(indicators: StrategyIndicator[], candles: RuntimeCandle[]) {
    if (indicators.length === 0) return false;
    return indicators.every((indicator) => this.evaluateIndicator(indicator, candles));
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

  private directionFromStrategy(
    event: StreamTickerEvent,
    marketType: 'FUTURES' | 'SPOT',
    strategy: ActiveBotStrategy
  ): SignalDirection | null {
    if (!strategy.strategyConfig) return null;

    const config = strategy.strategyConfig as {
      open?: {
        indicatorsLong?: unknown[];
        indicatorsShort?: unknown[];
      };
      openConditions?: {
        indicatorsLong?: unknown[];
        indicatorsShort?: unknown[];
      };
    };

    const longIndicators = [
      ...(Array.isArray(config.open?.indicatorsLong) ? config.open.indicatorsLong : []),
      ...(Array.isArray(config.openConditions?.indicatorsLong)
        ? config.openConditions.indicatorsLong
        : []),
    ]
      .map(toIndicator)
      .filter((item): item is StrategyIndicator => Boolean(item));

    const shortIndicators = [
      ...(Array.isArray(config.open?.indicatorsShort) ? config.open.indicatorsShort : []),
      ...(Array.isArray(config.openConditions?.indicatorsShort)
        ? config.openConditions.indicatorsShort
        : []),
    ]
      .map(toIndicator)
      .filter((item): item is StrategyIndicator => Boolean(item));

    const candles = this.getSeries(marketType, event.symbol, strategy.strategyInterval);
    if (!candles || candles.length === 0) return null;

    const longSignal = this.evaluateIndicators(longIndicators, candles);
    const shortSignal = this.evaluateIndicators(shortIndicators, candles);
    if (longSignal && !shortSignal) return 'LONG';
    if (shortSignal && !longSignal) return 'SHORT';
    if (!longSignal && !shortSignal && Math.abs(event.priceChangePercent24h) <= runtimeExitBand) {
      return 'EXIT';
    }
    return null;
  }

  private async handleTickerEvent(event: StreamTickerEvent) {
    upsertRuntimeTicker(event);
    await this.deps.processPositionAutomation(event);
    const bots = await this.deps.listActiveBots();
    await Promise.all(
      bots.map(async (bot) => {
        if (bot.marketType !== event.marketType) return;

        const eligibleGroups = bot.marketGroups.filter((group) => {
          if (group.symbols.length === 0) return true;
          return group.symbols.some((symbol) => symbol.toUpperCase() === event.symbol.toUpperCase());
        });

        await Promise.all(
          eligibleGroups.map(async (group) => {
            const groupEvalStartedAt = this.deps.nowMs();
            const strategyVotes: StrategyVote[] = group.strategies
              .map((strategy) => {
                const direction = this.directionFromStrategy(event, bot.marketType, strategy);
                if (!direction) return null;
                return {
                  strategyId: strategy.strategyId,
                  direction,
                  priority: strategy.priority,
                  weight: strategy.weight,
                } satisfies StrategyVote;
              })
              .filter((vote): vote is StrategyVote => Boolean(vote));

            const merged = group.strategies.length > 0
              ? this.mergeStrategyVotes(group.strategies, strategyVotes)
              : {
                  direction: toDirection(event),
                  strategyId: undefined,
                  metadata: {
                    mergePolicy: 'fallback_ticker',
                    reason: 'no_strategies_attached',
                  },
                };

            const direction = merged.direction;
            if (!direction) {
              metricsStore.recordRuntimeMergeOutcome('NO_TRADE');
              metricsStore.recordRuntimeGroupEvaluation(this.deps.nowMs() - groupEvalStartedAt);
              return;
            }

            const dedupeKey = `${bot.id}|${group.id}|${event.symbol}`;
            const now = this.deps.nowMs();
            const previous = this.recentlyProcessed.get(dedupeKey);
            if (
              previous &&
              previous.direction === direction &&
              now - previous.at < runtimeDirectionCooldownMs
            ) {
              metricsStore.recordRuntimeGroupEvaluation(this.deps.nowMs() - groupEvalStartedAt);
              return;
            }
            this.recentlyProcessed.set(dedupeKey, { direction, at: now });

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
                metricsStore.recordRuntimeMergeOutcome('NO_TRADE');
                metricsStore.recordRuntimeGroupEvaluation(this.deps.nowMs() - groupEvalStartedAt);
                return;
              }
            }

            await this.deps.createSignal({
              userId: bot.userId,
              botId: bot.id,
              strategyId: merged.strategyId,
              symbol: event.symbol,
              direction,
              confidence: Math.min(1, Math.abs(event.priceChangePercent24h) / 100),
              payload: {
                source: 'market_stream.ticker',
                botMarketGroupId: group.id,
                symbolGroupId: group.symbolGroupId,
                strategyDriven: group.strategies.length > 0,
                strategyInterval: group.strategies[0]?.strategyInterval ?? null,
                merge: merged.metadata,
                groupRisk: {
                  maxOpenPositions: group.maxOpenPositions,
                },
                eventTime: event.eventTime,
                lastPrice: event.lastPrice,
                priceChangePercent24h: event.priceChangePercent24h,
              },
            });

            await this.deps.orchestrateFn({
              userId: bot.userId,
              botId: bot.id,
              symbol: event.symbol,
              direction,
              strategyId: merged.strategyId,
              quantity: runtimeSignalQuantity,
              markPrice: event.lastPrice,
              mode: bot.mode,
            });
            metricsStore.recordRuntimeMergeOutcome(direction);
            metricsStore.recordRuntimeGroupEvaluation(this.deps.nowMs() - groupEvalStartedAt);
          })
        );
      })
    );

    const direction = toDirection(event);
    if (direction !== 'EXIT') return;

    const runtimeManagedExternalPositions = await this.deps.listRuntimeManagedExternalPositions();
    await Promise.all(
      runtimeManagedExternalPositions
        .filter((position) => position.symbol === event.symbol)
        .map(async (position) => {
          const dedupeKey = `manual|${position.userId}|${position.symbol}`;
          const now = this.deps.nowMs();
          const previous = this.recentlyProcessed.get(dedupeKey);
          if (
            previous &&
            previous.direction === direction &&
            now - previous.at < runtimeDirectionCooldownMs
          ) {
            return;
          }
          this.recentlyProcessed.set(dedupeKey, { direction, at: now });

          await this.deps.createSignal({
            userId: position.userId,
            botId: undefined,
            symbol: position.symbol,
            direction,
            confidence: Math.min(1, Math.abs(event.priceChangePercent24h) / 100),
            payload: {
              source: 'market_stream.ticker',
              managedManualPosition: true,
              eventTime: event.eventTime,
              lastPrice: event.lastPrice,
              priceChangePercent24h: event.priceChangePercent24h,
            },
          });

          await this.deps.orchestrateFn({
            userId: position.userId,
            symbol: position.symbol,
            direction: 'EXIT',
            quantity: runtimeSignalQuantity,
            markPrice: event.lastPrice,
            mode: runtimeManualPositionMode,
          });
        })
    );
  }
}

export const runtimeSignalLoop = new RuntimeSignalLoop();
