import { Prisma, SignalDirection } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { MarketStreamEvent, StreamTickerEvent } from '../market-stream/binanceStream.types';
import { subscribeMarketStreamEvents } from '../market-stream/marketStreamFanout';
import { analyzePreTrade } from './preTrade.service';
import { orchestrateRuntimeSignal } from './executionOrchestrator.service';

type ActiveBot = {
  id: string;
  userId: string;
  mode: 'PAPER' | 'LIVE';
};

type RuntimeSignalLoopDeps = {
  subscribe: (
    handler: (event: MarketStreamEvent) => void | Promise<void>
  ) => Promise<() => Promise<void>>;
  listActiveBots: () => Promise<ActiveBot[]>;
  createSignal: (params: {
    userId: string;
    botId: string;
    symbol: string;
    direction: SignalDirection;
    confidence: number;
    payload: Record<string, unknown>;
  }) => Promise<void>;
  analyzePreTradeFn: typeof analyzePreTrade;
  orchestrateFn: typeof orchestrateRuntimeSignal;
  nowMs: () => number;
};

const runtimeLongThreshold = Number.parseFloat(process.env.RUNTIME_SIGNAL_LONG_THRESHOLD ?? '1');
const runtimeShortThreshold = Number.parseFloat(process.env.RUNTIME_SIGNAL_SHORT_THRESHOLD ?? '-1');
const runtimeExitBand = Number.parseFloat(process.env.RUNTIME_SIGNAL_EXIT_BAND ?? '0.2');
const runtimeSignalQuantity = Number.parseFloat(process.env.RUNTIME_SIGNAL_QUANTITY ?? '0.01');
const runtimeDirectionCooldownMs = Number.parseInt(process.env.RUNTIME_SIGNAL_COOLDOWN_MS ?? '30000', 10);

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
      },
    });
    return bots.map((bot) => ({
      id: bot.id,
      userId: bot.userId,
      mode: bot.mode as 'PAPER' | 'LIVE',
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

  private async handleEvent(event: MarketStreamEvent) {
    if (event.type !== 'ticker') return;
    const direction = toDirection(event);
    if (!direction) return;

    const bots = await this.deps.listActiveBots();
    await Promise.all(
      bots.map(async (bot) => {
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
  }
}

export const runtimeSignalLoop = new RuntimeSignalLoop();
