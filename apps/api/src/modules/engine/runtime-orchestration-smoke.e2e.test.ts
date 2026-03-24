import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../prisma/client';
import { normalizeBinanceStreamEvent } from '../market-stream/binanceStream.service';
import { orchestrateRuntimeSignal } from './executionOrchestrator.service';

describe('runtime orchestration smoke (stream -> signal -> order -> position)', () => {
  beforeEach(async () => {
    await prisma.log.deleteMany();
    await prisma.backtestReport.deleteMany();
    await prisma.backtestTrade.deleteMany();
    await prisma.backtestRun.deleteMany();
    await prisma.trade.deleteMany();
    await prisma.order.deleteMany();
    await prisma.position.deleteMany();
    await prisma.signal.deleteMany();
    await prisma.botStrategy.deleteMany();
    await prisma.botSubagentConfig.deleteMany();
    await prisma.botAssistantConfig.deleteMany();
    await prisma.bot.deleteMany();
    await prisma.symbolGroup.deleteMany();
    await prisma.marketUniverse.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
  });

  it('opens and closes lifecycle from normalized stream payloads', async () => {
    const user = await prisma.user.create({
      data: { email: 'runtime-smoke@example.com', password: 'hashed-pass' },
    });

    const normalizedTicker = normalizeBinanceStreamEvent({
      stream: 'btcusdt@ticker',
      data: {
        e: '24hrTicker',
        E: 1_710_000_000_000,
        s: 'BTCUSDT',
        c: '64000.5',
        P: '1.25',
      },
    });

    expect(normalizedTicker).not.toBeNull();
    expect(normalizedTicker?.type).toBe('ticker');
    expect(normalizedTicker?.marketType).toBe('FUTURES');
    if (!normalizedTicker || normalizedTicker.type !== 'ticker') return;

    await prisma.signal.create({
      data: {
        userId: user.id,
        symbol: normalizedTicker.symbol,
        timeframe: '1m',
        direction: 'LONG',
        confidence: 0.82,
        payload: {
          source: 'market_stream.ticker',
          eventTime: normalizedTicker.eventTime,
          lastPrice: normalizedTicker.lastPrice,
          priceChangePercent24h: normalizedTicker.priceChangePercent24h,
        },
      },
    });

    const opened = await orchestrateRuntimeSignal({
      userId: user.id,
      symbol: normalizedTicker.symbol,
      direction: 'LONG',
      quantity: 0.05,
      markPrice: normalizedTicker.lastPrice,
      mode: 'PAPER',
    });

    expect(opened.status).toBe('opened');
    if (opened.status !== 'opened') return;

    const openedPosition = await prisma.position.findUniqueOrThrow({
      where: { id: opened.positionId },
    });
    expect(openedPosition.status).toBe('OPEN');
    expect(openedPosition.side).toBe('LONG');

    const openedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: opened.orderId },
    });
    expect(openedOrder.status).toBe('FILLED');
    expect(openedOrder.side).toBe('BUY');

    await prisma.signal.create({
      data: {
        userId: user.id,
        symbol: normalizedTicker.symbol,
        timeframe: '1m',
        direction: 'EXIT',
        confidence: 0.73,
        payload: {
          source: 'market_stream.ticker',
          reason: 'take_profit_signal',
          eventTime: normalizedTicker.eventTime + 60_000,
        },
      },
    });

    const closed = await orchestrateRuntimeSignal({
      userId: user.id,
      symbol: normalizedTicker.symbol,
      direction: 'EXIT',
      quantity: 0.05,
      markPrice: normalizedTicker.lastPrice + 50,
      mode: 'PAPER',
    });

    expect(closed.status).toBe('closed');
    if (closed.status !== 'closed') return;

    expect(closed).toEqual({
      status: 'closed',
      orderId: expect.any(String),
      positionId: opened.positionId,
    });

    const closedPosition = await prisma.position.findUniqueOrThrow({
      where: { id: opened.positionId },
    });
    expect(closedPosition.status).toBe('CLOSED');

    const exitOrder = await prisma.order.findUniqueOrThrow({
      where: { id: closed.orderId },
    });
    expect(exitOrder.status).toBe('FILLED');
    expect(exitOrder.side).toBe('SELL');
  });
});

