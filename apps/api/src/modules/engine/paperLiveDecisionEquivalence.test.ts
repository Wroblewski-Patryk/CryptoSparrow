import { describe, expect, it } from 'vitest';
import {
  OrderFlowGateway,
  PositionFlowGateway,
  RuntimeExecutionEventGateway,
  RuntimeExecutionMode,
  RuntimeSignalDirection,
  orchestrateRuntimeSignal,
} from './executionOrchestrator.service';

type MemoryPosition = {
  id: string;
  userId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  managementMode: 'BOT_MANAGED' | 'MANUAL_MANAGED';
  status: 'OPEN' | 'CLOSED';
};

const createInMemoryGateways = (mode: RuntimeExecutionMode) => {
  const positions: MemoryPosition[] = [];
  let orderCounter = 0;
  let positionCounter = 0;

  const orderGateway: OrderFlowGateway = {
    openOrder: async (_userId, input) => {
      orderCounter += 1;
      return {
        id: `order-${mode}-${orderCounter}`,
        userId: 'u1',
        symbol: input.symbol,
        side: input.side,
        type: input.type,
        status: mode === 'LIVE' ? 'OPEN' : 'FILLED',
        quantity: input.quantity,
        filledQuantity: mode === 'LIVE' ? 0 : input.quantity,
        createdAt: new Date(),
        updatedAt: new Date(),
        submittedAt: new Date(),
        filledAt: mode === 'LIVE' ? null : new Date(),
        botId: input.botId ?? null,
        strategyId: input.strategyId ?? null,
        positionId: null,
        price: null,
        stopPrice: null,
        averageFillPrice: null,
        fee: null,
        exchangeOrderId: null,
        canceledAt: null,
      };
    },
    closeOrder: async () => null,
    linkOrderToPosition: async () => undefined,
  };

  const positionGateway: PositionFlowGateway = {
    getOpenPositionBySymbol: async (_userId, symbol) => {
      const found = positions.find((position) => position.symbol === symbol && position.status === 'OPEN');
      if (!found) return null;
      return {
        id: found.id,
        userId: found.userId,
        externalId: null,
        origin: 'BOT',
        managementMode: found.managementMode,
        syncState: 'IN_SYNC',
        symbol: found.symbol,
        side: found.side,
        status: 'OPEN',
        entryPrice: 50000,
        quantity: found.quantity,
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
    },
    createPosition: async (input) => {
      positionCounter += 1;
      const next: MemoryPosition = {
        id: `position-${mode}-${positionCounter}`,
        userId: input.userId,
        symbol: input.symbol,
        side: input.side as 'LONG' | 'SHORT',
        quantity: input.quantity,
        managementMode: 'BOT_MANAGED',
        status: 'OPEN',
      };
      positions.push(next);
      return {
        id: next.id,
        userId: next.userId,
        externalId: null,
        origin: 'BOT',
        managementMode: next.managementMode,
        syncState: 'IN_SYNC',
        symbol: next.symbol,
        side: next.side,
        status: 'OPEN',
        entryPrice: input.entryPrice,
        quantity: next.quantity,
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
    },
    closePosition: async (positionId) => {
      const found = positions.find((position) => position.id === positionId);
      if (found) found.status = 'CLOSED';
    },
  };

  const eventGateway: RuntimeExecutionEventGateway = {
    writeEvent: async () => undefined,
  };

  return { orderGateway, positionGateway, eventGateway };
};

const runScenario = async (mode: RuntimeExecutionMode) => {
  const gateways = createInMemoryGateways(mode);
  const steps: RuntimeSignalDirection[] = ['LONG', 'SHORT', 'EXIT'];
  const outcomes: Array<{ status: string; reason?: string }> = [];

  for (const direction of steps) {
    const result = await orchestrateRuntimeSignal(
      {
        userId: 'u1',
        symbol: 'BTCUSDT',
        direction,
        quantity: 0.1,
        markPrice: 50000,
        mode,
      },
      gateways.orderGateway,
      gateways.positionGateway,
      gateways.eventGateway
    );

    outcomes.push(
      result.status === 'ignored'
        ? { status: result.status, reason: result.reason }
        : { status: result.status }
    );
  }

  return outcomes;
};

describe('paper/live decision equivalence', () => {
  it('keeps identical decision outcomes for same signal sequence', async () => {
    const paperOutcomes = await runScenario('PAPER');
    const liveOutcomes = await runScenario('LIVE');

    expect(paperOutcomes).toEqual(liveOutcomes);
    expect(paperOutcomes).toEqual([
      { status: 'opened' },
      { status: 'ignored', reason: 'no_flip_with_open_position' },
      { status: 'closed' },
    ]);
  });
});
