import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../../prisma/client';
import {
  buildOpenPositionLookupWhere,
  orchestrateRuntimeSignal,
  OrderFlowGateway,
  RuntimeExecutionDedupeGateway,
  PositionFlowGateway,
  RuntimeExecutionEventGateway,
  RuntimeTradeGateway,
} from './executionOrchestrator.service';

const createOrderGateway = (): OrderFlowGateway => ({
  openOrder: vi.fn().mockResolvedValue({
    id: 'order-1',
    userId: 'u1',
    symbol: 'BTCUSDT',
    side: 'BUY',
    type: 'MARKET',
    status: 'FILLED',
    quantity: 0.1,
    filledQuantity: 0.1,
    createdAt: new Date(),
    updatedAt: new Date(),
    submittedAt: new Date(),
    filledAt: new Date(),
    botId: null,
    strategyId: null,
    positionId: null,
    price: null,
    stopPrice: null,
    averageFillPrice: null,
    fee: null,
    feeSource: 'ESTIMATED',
    feePending: false,
    feeCurrency: null,
    effectiveFeeRate: null,
    exchangeOrderId: null,
    exchangeTradeId: null,
    canceledAt: null,
  }),
  closeOrder: vi.fn().mockResolvedValue(null),
  linkOrderToPosition: vi.fn().mockResolvedValue(undefined),
});

const createPositionGateway = (): PositionFlowGateway => ({
  getOpenPositionBySymbol: vi.fn().mockResolvedValue(null),
  createPosition: vi.fn().mockResolvedValue({
    id: 'position-1',
    userId: 'u1',
    externalId: null,
    origin: 'BOT',
    managementMode: 'BOT_MANAGED',
    syncState: 'IN_SYNC',
    symbol: 'BTCUSDT',
    side: 'LONG',
    status: 'OPEN',
    entryPrice: 43000,
    quantity: 0.1,
    leverage: 1,
    openedAt: new Date(),
    closedAt: null,
    realizedPnl: null,
    unrealizedPnl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    botId: null,
    strategyId: null,
    stopLoss: null,
    takeProfit: null,
  }),
  closePosition: vi.fn().mockResolvedValue(undefined),
});

const createEventGateway = (): RuntimeExecutionEventGateway => ({
  writeEvent: vi.fn().mockResolvedValue(undefined),
});

const createTradeGateway = (): RuntimeTradeGateway => ({
  createTrade: vi.fn().mockResolvedValue(undefined),
});

const createDedupeGateway = (): RuntimeExecutionDedupeGateway => ({
  acquire: vi.fn().mockResolvedValue({ outcome: 'execute', dedupeKey: 'dedupe-1' }),
  markSucceeded: vi.fn().mockResolvedValue(undefined),
  markFailed: vi.fn().mockResolvedValue(undefined),
});

describe('buildOpenPositionLookupWhere', () => {
  it('scopes LIVE lookup by wallet when walletId is available', () => {
    const where = buildOpenPositionLookupWhere({
      userId: 'u1',
      symbol: 'btcusdt',
      mode: 'LIVE',
      botId: 'bot-1',
      walletId: 'wallet-live',
    });

    expect(where).toEqual({
      userId: 'u1',
      symbol: 'BTCUSDT',
      status: 'OPEN',
      walletId: 'wallet-live',
    });
  });

  it('scopes PAPER lookup by bot id', () => {
    const where = buildOpenPositionLookupWhere({
      userId: 'u1',
      symbol: 'ETHUSDT',
      mode: 'PAPER',
      botId: 'bot-paper',
      walletId: 'wallet-paper',
    });

    expect(where).toEqual({
      userId: 'u1',
      symbol: 'ETHUSDT',
      status: 'OPEN',
      botId: 'bot-paper',
    });
  });
});

describe('orchestrateRuntimeSignal', () => {
  it('opens order and position for LONG signal', async () => {
    const orderGateway = createOrderGateway();
    const positionGateway = createPositionGateway();
    const eventGateway = createEventGateway();
    const tradeGateway = createTradeGateway();
    const strategyLookupSpy = vi.spyOn(prisma.strategy, 'findFirst');

    const result = await orchestrateRuntimeSignal(
      {
        userId: 'u1',
        symbol: 'BTCUSDT',
        direction: 'LONG',
        quantity: 0.1,
        markPrice: 43000,
        mode: 'PAPER',
      },
      orderGateway,
      positionGateway,
      eventGateway,
      tradeGateway
    );

    expect(result).toEqual({
      status: 'opened',
      orderId: 'order-1',
      positionId: 'position-1',
    });
    expect(orderGateway.openOrder).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ side: 'BUY', type: 'MARKET', riskAck: true })
    );
    expect(positionGateway.getOpenPositionBySymbol).toHaveBeenCalledWith({
      userId: 'u1',
      symbol: 'BTCUSDT',
      mode: 'PAPER',
      botId: undefined,
      walletId: undefined,
    });
    expect(positionGateway.createPosition).toHaveBeenCalled();
    expect(orderGateway.linkOrderToPosition).toHaveBeenCalledWith('order-1', 'position-1');
    expect(strategyLookupSpy).not.toHaveBeenCalled();
    expect(tradeGateway.createTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        positionId: 'position-1',
        side: 'BUY',
      })
    );
    expect(eventGateway.writeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'opened',
        symbol: 'BTCUSDT',
      })
    );
  });

  it('reuses persisted OPEN execution result and skips duplicate side effects', async () => {
    const orderGateway = createOrderGateway();
    const positionGateway = createPositionGateway();
    const eventGateway = createEventGateway();
    const tradeGateway = createTradeGateway();
    const dedupeGateway = createDedupeGateway();
    (dedupeGateway.acquire as ReturnType<typeof vi.fn>).mockResolvedValue({
      outcome: 'reused',
      dedupeKey: 'v1|OPEN|...',
      orderId: 'order-existing',
      positionId: 'position-existing',
    });

    const result = await orchestrateRuntimeSignal(
      {
        userId: 'u1',
        botId: 'bot-1',
        botMarketGroupId: 'group-1',
        symbol: 'BTCUSDT',
        direction: 'LONG',
        strategyInterval: '1m',
        candleOpenTime: 1_000,
        candleCloseTime: 59_000,
        quantity: 0.1,
        markPrice: 43000,
        mode: 'PAPER',
      },
      orderGateway,
      positionGateway,
      eventGateway,
      tradeGateway,
      dedupeGateway
    );

    expect(result).toEqual({
      status: 'opened',
      orderId: 'order-existing',
      positionId: 'position-existing',
    });
    expect(orderGateway.openOrder).not.toHaveBeenCalled();
    expect(positionGateway.createPosition).not.toHaveBeenCalled();
    expect(tradeGateway.createTrade).not.toHaveBeenCalled();
  });

  it('returns ignored when OPEN dedupe is still inflight', async () => {
    const orderGateway = createOrderGateway();
    const positionGateway = createPositionGateway();
    const eventGateway = createEventGateway();
    const tradeGateway = createTradeGateway();
    const dedupeGateway = createDedupeGateway();
    (dedupeGateway.acquire as ReturnType<typeof vi.fn>).mockResolvedValue({
      outcome: 'inflight',
      dedupeKey: 'v1|OPEN|...',
    });

    const result = await orchestrateRuntimeSignal(
      {
        userId: 'u1',
        botId: 'bot-1',
        botMarketGroupId: 'group-1',
        symbol: 'BTCUSDT',
        direction: 'LONG',
        strategyInterval: '1m',
        candleOpenTime: 1_000,
        candleCloseTime: 59_000,
        quantity: 0.1,
        markPrice: 43000,
        mode: 'PAPER',
      },
      orderGateway,
      positionGateway,
      eventGateway,
      tradeGateway,
      dedupeGateway
    );

    expect(result).toEqual({ status: 'ignored', reason: 'dedupe_inflight' });
    expect(orderGateway.openOrder).not.toHaveBeenCalled();
    expect(positionGateway.createPosition).not.toHaveBeenCalled();
    expect(tradeGateway.createTrade).not.toHaveBeenCalled();
  });

  it('returns ignored when EXIT arrives without open position', async () => {
    const orderGateway = createOrderGateway();
    const positionGateway = createPositionGateway();
    const eventGateway = createEventGateway();
    const tradeGateway = createTradeGateway();

    const result = await orchestrateRuntimeSignal(
      {
        userId: 'u1',
        symbol: 'BTCUSDT',
        direction: 'EXIT',
        quantity: 0.1,
        markPrice: 43000,
        mode: 'PAPER',
      },
      orderGateway,
      positionGateway,
      eventGateway,
      tradeGateway
    );

    expect(result).toEqual({ status: 'ignored', reason: 'no_open_position' });
    expect(orderGateway.openOrder).not.toHaveBeenCalled();
    expect(tradeGateway.createTrade).not.toHaveBeenCalled();
    expect(eventGateway.writeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ignored',
        reason: 'no_open_position',
      })
    );
  });

  it('closes open position on EXIT signal', async () => {
    const orderGateway = createOrderGateway();
    const positionGateway = createPositionGateway();
    const eventGateway = createEventGateway();
    const tradeGateway = createTradeGateway();
    const dedupeGateway = createDedupeGateway();
    (positionGateway.getOpenPositionBySymbol as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'position-open',
      userId: 'u1',
      externalId: null,
      origin: 'BOT',
      managementMode: 'BOT_MANAGED',
      syncState: 'IN_SYNC',
      symbol: 'BTCUSDT',
      side: 'LONG',
      status: 'OPEN',
      entryPrice: 43000,
      quantity: 0.2,
      leverage: 1,
      openedAt: new Date(),
      closedAt: null,
      realizedPnl: null,
      unrealizedPnl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      botId: null,
      strategyId: null,
      stopLoss: null,
      takeProfit: null,
    });
    (orderGateway.closeOrder as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'order-1',
      userId: 'u1',
      symbol: 'BTCUSDT',
      side: 'SELL',
      type: 'MARKET',
      status: 'FILLED',
      quantity: 0.2,
      filledQuantity: 0.2,
      createdAt: new Date(),
      updatedAt: new Date(),
      submittedAt: new Date(),
      filledAt: new Date(),
      botId: null,
      strategyId: null,
      positionId: 'position-open',
      price: null,
      stopPrice: null,
      averageFillPrice: null,
      fee: null,
      feeSource: 'ESTIMATED',
      feePending: false,
      feeCurrency: null,
      effectiveFeeRate: null,
      exchangeOrderId: null,
      exchangeTradeId: null,
      canceledAt: null,
    });

    const result = await orchestrateRuntimeSignal(
      {
        userId: 'u1',
        symbol: 'BTCUSDT',
        direction: 'EXIT',
        quantity: 0.1,
        markPrice: 43000,
        mode: 'LIVE',
      },
      orderGateway,
      positionGateway,
      eventGateway,
      tradeGateway,
      dedupeGateway
    );

    expect(result).toEqual({
      status: 'closed',
      orderId: 'order-1',
      positionId: 'position-open',
    });
    expect(orderGateway.openOrder).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ side: 'SELL', quantity: 0.2, mode: 'LIVE' })
    );
    expect(positionGateway.closePosition).toHaveBeenCalledWith(
      'position-open',
      'u1',
      expect.objectContaining({
        realizedPnl: expect.any(Number),
      })
    );
    expect(orderGateway.closeOrder).not.toHaveBeenCalled();
    expect(tradeGateway.createTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        positionId: 'position-open',
        side: 'SELL',
      })
    );
    expect(eventGateway.writeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'closed',
        positionId: 'position-open',
      })
    );
  });

  it('ignores opposite direction when open position already exists (no-flip)', async () => {
    const orderGateway = createOrderGateway();
    const positionGateway = createPositionGateway();
    const eventGateway = createEventGateway();
    const tradeGateway = createTradeGateway();
    (positionGateway.getOpenPositionBySymbol as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'position-open',
      userId: 'u1',
      externalId: null,
      origin: 'BOT',
      managementMode: 'BOT_MANAGED',
      syncState: 'IN_SYNC',
      symbol: 'BTCUSDT',
      side: 'LONG',
      status: 'OPEN',
      entryPrice: 43000,
      quantity: 0.2,
      leverage: 1,
      openedAt: new Date(),
      closedAt: null,
      realizedPnl: null,
      unrealizedPnl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      botId: null,
      strategyId: null,
      stopLoss: null,
      takeProfit: null,
    });

    const result = await orchestrateRuntimeSignal(
      {
        userId: 'u1',
        symbol: 'BTCUSDT',
        direction: 'SHORT',
        quantity: 0.1,
        markPrice: 42900,
        mode: 'PAPER',
      },
      orderGateway,
      positionGateway,
      eventGateway,
      tradeGateway
    );

    expect(result).toEqual({ status: 'ignored', reason: 'no_flip_with_open_position' });
    expect(orderGateway.openOrder).not.toHaveBeenCalled();
    expect(positionGateway.createPosition).not.toHaveBeenCalled();
    expect(tradeGateway.createTrade).not.toHaveBeenCalled();
    expect(eventGateway.writeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ignored',
        reason: 'no_flip_with_open_position',
      })
    );
  });

  it('ignores runtime action for manual-managed symbol', async () => {
    const orderGateway = createOrderGateway();
    const positionGateway = createPositionGateway();
    const eventGateway = createEventGateway();
    const tradeGateway = createTradeGateway();
    (positionGateway.getOpenPositionBySymbol as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'position-open',
      userId: 'u1',
      externalId: null,
      origin: 'EXCHANGE_SYNC',
      managementMode: 'MANUAL_MANAGED',
      syncState: 'IN_SYNC',
      symbol: 'BTCUSDT',
      side: 'LONG',
      status: 'OPEN',
      entryPrice: 43000,
      quantity: 0.2,
      leverage: 1,
      openedAt: new Date(),
      closedAt: null,
      realizedPnl: null,
      unrealizedPnl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      botId: null,
      strategyId: null,
      stopLoss: null,
      takeProfit: null,
    });

    const result = await orchestrateRuntimeSignal(
      {
        userId: 'u1',
        symbol: 'BTCUSDT',
        direction: 'EXIT',
        quantity: 0.1,
        markPrice: 42900,
        mode: 'LIVE',
      },
      orderGateway,
      positionGateway,
      eventGateway,
      tradeGateway
    );

    expect(result).toEqual({ status: 'ignored', reason: 'manual_managed_symbol' });
    expect(orderGateway.openOrder).not.toHaveBeenCalled();
    expect(positionGateway.closePosition).not.toHaveBeenCalled();
    expect(tradeGateway.createTrade).not.toHaveBeenCalled();
    expect(eventGateway.writeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ignored',
        reason: 'manual_managed_symbol',
      })
    );
  });

  it('returns ignored when CLOSE dedupe is still inflight', async () => {
    const orderGateway = createOrderGateway();
    const positionGateway = createPositionGateway();
    const eventGateway = createEventGateway();
    const tradeGateway = createTradeGateway();
    const dedupeGateway = createDedupeGateway();
    (positionGateway.getOpenPositionBySymbol as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'position-open',
      userId: 'u1',
      externalId: null,
      origin: 'BOT',
      managementMode: 'BOT_MANAGED',
      syncState: 'IN_SYNC',
      symbol: 'BTCUSDT',
      side: 'LONG',
      status: 'OPEN',
      entryPrice: 43000,
      quantity: 0.2,
      leverage: 1,
      openedAt: new Date(),
      closedAt: null,
      realizedPnl: null,
      unrealizedPnl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      botId: null,
      strategyId: null,
      stopLoss: null,
      takeProfit: null,
    });
    (dedupeGateway.acquire as ReturnType<typeof vi.fn>).mockResolvedValue({
      outcome: 'inflight',
      dedupeKey: 'v1|CLOSE|...',
    });

    const result = await orchestrateRuntimeSignal(
      {
        userId: 'u1',
        symbol: 'BTCUSDT',
        direction: 'EXIT',
        quantity: 0.2,
        markPrice: 43000,
        mode: 'PAPER',
      },
      orderGateway,
      positionGateway,
      eventGateway,
      tradeGateway,
      dedupeGateway
    );

    expect(result).toEqual({ status: 'ignored', reason: 'dedupe_inflight' });
    expect(orderGateway.openOrder).not.toHaveBeenCalled();
    expect(positionGateway.closePosition).not.toHaveBeenCalled();
    expect(tradeGateway.createTrade).not.toHaveBeenCalled();
  });
});
