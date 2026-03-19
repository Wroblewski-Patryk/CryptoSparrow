import { describe, expect, it, vi } from 'vitest';
import {
  orchestrateRuntimeSignal,
  OrderFlowGateway,
  PositionFlowGateway,
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
    exchangeOrderId: null,
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

describe('orchestrateRuntimeSignal', () => {
  it('opens order and position for LONG signal', async () => {
    const orderGateway = createOrderGateway();
    const positionGateway = createPositionGateway();

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
      positionGateway
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
    expect(positionGateway.createPosition).toHaveBeenCalled();
    expect(orderGateway.linkOrderToPosition).toHaveBeenCalledWith('order-1', 'position-1');
  });

  it('returns ignored when EXIT arrives without open position', async () => {
    const orderGateway = createOrderGateway();
    const positionGateway = createPositionGateway();

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
      positionGateway
    );

    expect(result).toEqual({ status: 'ignored', reason: 'no_open_position' });
    expect(orderGateway.openOrder).not.toHaveBeenCalled();
  });

  it('closes open position on EXIT signal', async () => {
    const orderGateway = createOrderGateway();
    const positionGateway = createPositionGateway();
    (positionGateway.getOpenPositionBySymbol as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'position-open',
      userId: 'u1',
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
      exchangeOrderId: null,
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
      positionGateway
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
    expect(positionGateway.closePosition).toHaveBeenCalledWith('position-open', 'u1');
    expect(orderGateway.closeOrder).toHaveBeenCalledWith('u1', 'order-1', { riskAck: true });
  });
});
