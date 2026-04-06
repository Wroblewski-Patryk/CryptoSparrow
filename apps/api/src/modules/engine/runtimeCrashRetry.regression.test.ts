import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  orchestrateRuntimeSignal,
  OrderFlowGateway,
  PositionFlowGateway,
  RuntimeExecutionDedupeGateway,
  RuntimeExecutionEventGateway,
  RuntimeTradeGateway,
} from './executionOrchestrator.service';
import { runtimeTelemetryService } from './runtimeTelemetry.service';

type MemoryDedupe = {
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  orderId?: string | null;
  positionId?: string | null;
};

const createMemoryDedupeGateway = (): RuntimeExecutionDedupeGateway => {
  const store = new Map<string, MemoryDedupe>();
  return {
    acquire: vi.fn(async (input) => {
      const existing = store.get(input.dedupeKey);
      if (!existing) {
        store.set(input.dedupeKey, { status: 'PENDING' });
        return { outcome: 'execute', dedupeKey: input.dedupeKey };
      }
      if (existing.status === 'SUCCEEDED') {
        return {
          outcome: 'reused',
          dedupeKey: input.dedupeKey,
          orderId: existing.orderId,
          positionId: existing.positionId,
        };
      }
      return { outcome: 'inflight', dedupeKey: input.dedupeKey };
    }),
    markSucceeded: vi.fn(async (input) => {
      store.set(input.dedupeKey, {
        status: 'SUCCEEDED',
        orderId: input.orderId,
        positionId: input.positionId,
      });
    }),
    markFailed: vi.fn(async (input) => {
      store.set(input.dedupeKey, { status: 'FAILED' });
    }),
  };
};

const noopEventGateway: RuntimeExecutionEventGateway = {
  writeEvent: vi.fn().mockResolvedValue(undefined),
};

const noopTradeGateway: RuntimeTradeGateway = {
  createTrade: vi.fn().mockResolvedValue(undefined),
};

describe('runtime crash/retry regression', () => {
  beforeEach(() => {
    vi.spyOn(runtimeTelemetryService, 'upsertRuntimeSymbolStat').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not duplicate OPEN side effect after restart replay', async () => {
    const dedupe = createMemoryDedupeGateway();
    let openOrderCalls = 0;
    let createPositionCalls = 0;

    const createGateways = (): { orderGateway: OrderFlowGateway; positionGateway: PositionFlowGateway } => ({
      orderGateway: {
        openOrder: vi.fn(async (_userId, input) => {
          openOrderCalls += 1;
          return {
            id: `open-order-${openOrderCalls}`,
            userId: 'u1',
            origin: 'BOT',
            managementMode: 'BOT_MANAGED',
            syncState: 'IN_SYNC',
            symbol: input.symbol,
            side: input.side,
            type: input.type,
            status: 'FILLED',
            quantity: input.quantity,
            filledQuantity: input.quantity,
            createdAt: new Date(),
            updatedAt: new Date(),
            submittedAt: new Date(),
            filledAt: new Date(),
            botId: input.botId ?? null,
            strategyId: input.strategyId ?? null,
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
          };
        }),
        closeOrder: vi.fn(async () => null),
        linkOrderToPosition: vi.fn(async () => undefined),
      },
      positionGateway: {
        getOpenPositionBySymbol: vi.fn(async () => null),
        createPosition: vi.fn(async (input) => {
          createPositionCalls += 1;
          return {
            id: `open-position-${createPositionCalls}`,
            userId: input.userId,
            externalId: null,
            origin: 'BOT',
            managementMode: 'BOT_MANAGED',
            syncState: 'IN_SYNC',
            symbol: input.symbol,
            side: input.side,
            status: 'OPEN',
            entryPrice: input.entryPrice,
            quantity: input.quantity,
            leverage: input.leverage ?? 1,
            openedAt: new Date(),
            closedAt: null,
            realizedPnl: null,
            unrealizedPnl: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            botId: input.botId ?? null,
            strategyId: input.strategyId ?? null,
            stopLoss: null,
            takeProfit: null,
          };
        }),
        closePosition: vi.fn(async () => undefined),
      },
    });

    const runtimeA = createGateways();
    const first = await orchestrateRuntimeSignal(
      {
        userId: 'u1',
        botId: 'bot-1',
        botMarketGroupId: 'group-1',
        runtimeSessionId: 'session-1',
        strategyId: 'strategy-1',
        strategyInterval: '1m',
        symbol: 'BTCUSDT',
        direction: 'LONG',
        quantity: 0.1,
        markPrice: 42_000,
        mode: 'PAPER',
        candleOpenTime: 1_000,
        candleCloseTime: 59_000,
      },
      runtimeA.orderGateway,
      runtimeA.positionGateway,
      noopEventGateway,
      noopTradeGateway,
      dedupe
    );

    const runtimeB = createGateways();
    const second = await orchestrateRuntimeSignal(
      {
        userId: 'u1',
        botId: 'bot-1',
        botMarketGroupId: 'group-1',
        runtimeSessionId: 'session-2',
        strategyId: 'strategy-1',
        strategyInterval: '1m',
        symbol: 'BTCUSDT',
        direction: 'LONG',
        quantity: 0.1,
        markPrice: 42_000,
        mode: 'PAPER',
        candleOpenTime: 1_000,
        candleCloseTime: 59_000,
      },
      runtimeB.orderGateway,
      runtimeB.positionGateway,
      noopEventGateway,
      noopTradeGateway,
      dedupe
    );

    expect(first).toEqual({
      status: 'opened',
      orderId: 'open-order-1',
      positionId: 'open-position-1',
    });
    expect(second).toEqual({
      status: 'opened',
      orderId: 'open-order-1',
      positionId: 'open-position-1',
    });
    expect(openOrderCalls).toBe(1);
    expect(createPositionCalls).toBe(1);
  });

  it('does not duplicate CLOSE side effect after restart replay', async () => {
    const dedupe = createMemoryDedupeGateway();
    let closeOpenOrderCalls = 0;
    let closePositionCalls = 0;

    const createGateways = (): { orderGateway: OrderFlowGateway; positionGateway: PositionFlowGateway } => ({
      orderGateway: {
        openOrder: vi.fn(async (_userId, input) => {
          closeOpenOrderCalls += 1;
          return {
            id: `close-order-${closeOpenOrderCalls}`,
            userId: 'u1',
            origin: 'BOT',
            managementMode: 'BOT_MANAGED',
            syncState: 'IN_SYNC',
            symbol: input.symbol,
            side: input.side,
            type: input.type,
            status: 'FILLED',
            quantity: input.quantity,
            filledQuantity: input.quantity,
            createdAt: new Date(),
            updatedAt: new Date(),
            submittedAt: new Date(),
            filledAt: new Date(),
            botId: input.botId ?? null,
            strategyId: input.strategyId ?? null,
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
          };
        }),
        closeOrder: vi.fn(async () => null),
        linkOrderToPosition: vi.fn(async () => undefined),
      },
      positionGateway: {
        getOpenPositionBySymbol: vi.fn(async () => ({
          id: 'position-open-1',
          userId: 'u1',
          externalId: null,
          origin: 'BOT',
          managementMode: 'BOT_MANAGED',
          syncState: 'IN_SYNC',
          symbol: 'BTCUSDT',
          side: 'LONG',
          status: 'OPEN',
          entryPrice: 41_500,
          quantity: 0.2,
          leverage: 1,
          openedAt: new Date(),
          closedAt: null,
          realizedPnl: null,
          unrealizedPnl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          botId: 'bot-1',
          strategyId: 'strategy-1',
          stopLoss: null,
          takeProfit: null,
        })),
        createPosition: vi.fn(async () => {
          throw new Error('createPosition should not be called for EXIT');
        }),
        closePosition: vi.fn(async () => {
          closePositionCalls += 1;
        }),
      },
    });

    const runtimeA = createGateways();
    const first = await orchestrateRuntimeSignal(
      {
        userId: 'u1',
        botId: 'bot-1',
        runtimeSessionId: 'session-1',
        strategyId: 'strategy-1',
        symbol: 'BTCUSDT',
        direction: 'EXIT',
        quantity: 0.2,
        markPrice: 42_000,
        mode: 'PAPER',
        reason: 'take_profit',
      },
      runtimeA.orderGateway,
      runtimeA.positionGateway,
      noopEventGateway,
      noopTradeGateway,
      dedupe
    );

    const runtimeB = createGateways();
    const second = await orchestrateRuntimeSignal(
      {
        userId: 'u1',
        botId: 'bot-1',
        runtimeSessionId: 'session-2',
        strategyId: 'strategy-1',
        symbol: 'BTCUSDT',
        direction: 'EXIT',
        quantity: 0.2,
        markPrice: 42_000,
        mode: 'PAPER',
        reason: 'take_profit',
      },
      runtimeB.orderGateway,
      runtimeB.positionGateway,
      noopEventGateway,
      noopTradeGateway,
      dedupe
    );

    expect(first).toEqual({
      status: 'closed',
      orderId: 'close-order-1',
      positionId: 'position-open-1',
    });
    expect(second).toEqual({
      status: 'closed',
      orderId: 'close-order-1',
      positionId: 'position-open-1',
    });
    expect(closeOpenOrderCalls).toBe(1);
    expect(closePositionCalls).toBe(1);
  });
});
