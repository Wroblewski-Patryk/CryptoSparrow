import { describe, expect, it, vi } from 'vitest';
import {
  orchestrateRuntimeSignal,
  OrderFlowGateway,
  PositionFlowGateway,
} from './executionOrchestrator.service';
import { processPaperLifecycleTick } from './paperLifecycle.service';
import { orderSideToPositionSide } from './sharedExecutionCore';

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

describe('execution adapter parity', () => {
  it('returns same action contract for PAPER and LIVE when context is identical', async () => {
    const paperOrderGateway = createOrderGateway();
    const paperPositionGateway = createPositionGateway();
    const liveOrderGateway = createOrderGateway();
    const livePositionGateway = createPositionGateway();

    const paper = await orchestrateRuntimeSignal(
      {
        userId: 'u1',
        symbol: 'BTCUSDT',
        direction: 'LONG',
        quantity: 0.1,
        markPrice: 43000,
        mode: 'PAPER',
      },
      paperOrderGateway,
      paperPositionGateway
    );

    const live = await orchestrateRuntimeSignal(
      {
        userId: 'u1',
        symbol: 'BTCUSDT',
        direction: 'LONG',
        quantity: 0.1,
        markPrice: 43000,
        mode: 'LIVE',
      },
      liveOrderGateway,
      livePositionGateway
    );

    expect(paper.status).toBe('opened');
    expect(live.status).toBe('opened');
  });

  it('keeps same ignore reason for no-flip in PAPER and LIVE', async () => {
    const existingOpen = {
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
    };

    const paperOrderGateway = createOrderGateway();
    const paperPositionGateway = createPositionGateway();
    (paperPositionGateway.getOpenPositionBySymbol as ReturnType<typeof vi.fn>).mockResolvedValue(
      existingOpen
    );

    const liveOrderGateway = createOrderGateway();
    const livePositionGateway = createPositionGateway();
    (livePositionGateway.getOpenPositionBySymbol as ReturnType<typeof vi.fn>).mockResolvedValue(
      existingOpen
    );

    const paper = await orchestrateRuntimeSignal(
      {
        userId: 'u1',
        symbol: 'BTCUSDT',
        direction: 'SHORT',
        quantity: 0.1,
        markPrice: 42900,
        mode: 'PAPER',
      },
      paperOrderGateway,
      paperPositionGateway
    );

    const live = await orchestrateRuntimeSignal(
      {
        userId: 'u1',
        symbol: 'BTCUSDT',
        direction: 'SHORT',
        quantity: 0.1,
        markPrice: 42900,
        mode: 'LIVE',
      },
      liveOrderGateway,
      livePositionGateway
    );

    expect(paper).toEqual({ status: 'ignored', reason: 'no_flip_with_open_position' });
    expect(live).toEqual({ status: 'ignored', reason: 'no_flip_with_open_position' });
  });

  it('uses shared order-side mapping in paper lifecycle entry path', () => {
    const result = processPaperLifecycleTick(
      { position: null, orderState: {} },
      {
        markPrice: 50000,
        entryOrder: {
          side: 'SELL',
          type: 'MARKET',
          quantity: 0.1,
        },
        management: {},
      }
    );

    expect(result.openedPosition).toBe(true);
    expect(result.nextState.position?.side).toBe(orderSideToPositionSide('SELL'));
  });
});
