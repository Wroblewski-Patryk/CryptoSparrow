import { Prisma, SignalDirection } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { MarketStreamEvent, StreamTickerEvent } from '../market-stream/binanceStream.types';
import { subscribeMarketStreamEvents } from '../market-stream/marketStreamFanout';
import { analyzePreTrade } from './preTrade.service';
import { orchestrateRuntimeSignal } from './executionOrchestrator.service';
import { runtimePositionAutomationService } from './runtimePositionAutomation.service';
import { upsertRuntimeTicker } from './runtimeTickerStore';

type ActiveBot = {
  id: string;
  userId: string;
  mode: 'PAPER' | 'LIVE';
  marketType: 'FUTURES' | 'SPOT';
};

type RuntimeSignalLoopDeps = {
  subscribe: (
    handler: (event: MarketStreamEvent) => void | Promise<void>
  ) => Promise<() => Promise<void>>;
  listActiveBots: () => Promise<ActiveBot[]>;
  listManualManagedPositions: () => Promise<Array<{ userId: string; symbol: string }>>;
  createSignal: (params: {
    userId: string;
    botId?: string;
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
      },
    });
    return bots.map((bot) => ({
      id: bot.id,
      userId: bot.userId,
      mode: bot.mode as 'PAPER' | 'LIVE',
      marketType: bot.marketType,
    }));
  },
  listManualManagedPositions: async () => {
    const positions = await prisma.position.findMany({
      where: {
        status: 'OPEN',
        botId: null,
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
  createSignal: async (params) => {
    await prisma.signal.create({
      data: {
        userId: params.userId,
        botId: params.botId,
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

export class RuntimeSignalLoop {
  private unsubscribe: (() => Promise<void>) | null = null;
  private readonly recentlyProcessed = new Map<string, { direction: SignalDirection; at: number }>();

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
    if (event.type !== 'ticker') return;
    await this.handleTickerEvent(event);
  }

  private async handleTickerEvent(event: StreamTickerEvent) {
    upsertRuntimeTicker(event);
    await this.deps.processPositionAutomation(event);
    const direction = toDirection(event);
    if (!direction) return;

    const bots = await this.deps.listActiveBots();
    await Promise.all(
      bots.map(async (bot) => {
        if (bot.marketType !== event.marketType) return;

        const dedupeKey = `${bot.id}|${event.symbol}`;
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

        if (direction === 'LONG' || direction === 'SHORT') {
          const preTradeDecision = await this.deps.analyzePreTradeFn({
            userId: bot.userId,
            botId: bot.id,
            symbol: event.symbol,
            mode: bot.mode,
            marketType: event.marketType,
          });
          if (!preTradeDecision.allowed) {
            return;
          }
        }

        await this.deps.createSignal({
          userId: bot.userId,
          botId: bot.id,
          symbol: event.symbol,
          direction,
          confidence: Math.min(1, Math.abs(event.priceChangePercent24h) / 100),
          payload: {
            source: 'market_stream.ticker',
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
          quantity: runtimeSignalQuantity,
          markPrice: event.lastPrice,
          mode: bot.mode,
        });
      })
    );

    if (direction !== 'EXIT') return;

    const manualPositions = await this.deps.listManualManagedPositions();
    await Promise.all(
      manualPositions
        .filter((manualPosition) => manualPosition.symbol === event.symbol)
        .map(async (manualPosition) => {
          const dedupeKey = `manual|${manualPosition.userId}|${manualPosition.symbol}`;
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
            userId: manualPosition.userId,
            botId: undefined,
            symbol: manualPosition.symbol,
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
            userId: manualPosition.userId,
            symbol: manualPosition.symbol,
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
