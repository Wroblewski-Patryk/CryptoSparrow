import { Order, Position, PositionSide, Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { closeOrder as closeOrderLifecycle, openOrder as openOrderLifecycle } from '../orders/orders.service';

export type RuntimeSignalDirection = 'LONG' | 'SHORT' | 'EXIT';
export type RuntimeExecutionMode = 'PAPER' | 'LIVE';

export type RuntimeSignalInput = {
  userId: string;
  botId?: string;
  symbol: string;
  direction: RuntimeSignalDirection;
  quantity: number;
  markPrice: number;
  mode: RuntimeExecutionMode;
};

type OrchestrationResult =
  | { status: 'opened'; orderId: string; positionId: string }
  | { status: 'closed'; orderId: string; positionId: string }
  | {
      status: 'ignored';
      reason:
        | 'no_open_position'
        | 'no_flip_with_open_position'
        | 'already_open_same_side'
        | 'manual_managed_symbol';
    };

export interface OrderFlowGateway {
  openOrder(userId: string, input: {
    botId?: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'MARKET';
    quantity: number;
    mode: RuntimeExecutionMode;
    riskAck: boolean;
  }): Promise<Order>;
  closeOrder(userId: string, orderId: string, input: { riskAck: boolean }): Promise<Order | null>;
  linkOrderToPosition(orderId: string, positionId: string): Promise<void>;
}

export interface PositionFlowGateway {
  getOpenPositionBySymbol(userId: string, symbol: string): Promise<Position | null>;
  createPosition(input: Prisma.PositionUncheckedCreateInput): Promise<Position>;
  closePosition(positionId: string, userId: string): Promise<void>;
}

const defaultOrderGateway: OrderFlowGateway = {
  openOrder: (userId, input) =>
    openOrderLifecycle(userId, {
      ...input,
      riskAck: input.riskAck,
    }),
  closeOrder: (userId, orderId, input) => closeOrderLifecycle(userId, orderId, input),
  linkOrderToPosition: async (orderId, positionId) => {
    await prisma.order.update({
      where: { id: orderId },
      data: { positionId },
    });
  },
};

const defaultPositionGateway: PositionFlowGateway = {
  getOpenPositionBySymbol: (userId, symbol) =>
    prisma.position.findFirst({
      where: { userId, symbol, status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
    }),
  createPosition: (input) => prisma.position.create({ data: input }),
  closePosition: async (positionId, userId) => {
    await prisma.position.updateMany({
      where: { id: positionId, userId, status: 'OPEN' },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
  },
};

const directionToOrderSide = (direction: 'LONG' | 'SHORT'): 'BUY' | 'SELL' =>
  direction === 'LONG' ? 'BUY' : 'SELL';

const directionToPositionSide = (direction: 'LONG' | 'SHORT'): PositionSide =>
  direction === 'LONG' ? 'LONG' : 'SHORT';

export const orchestrateRuntimeSignal = async (
  input: RuntimeSignalInput,
  orderGateway: OrderFlowGateway = defaultOrderGateway,
  positionGateway: PositionFlowGateway = defaultPositionGateway
): Promise<OrchestrationResult> => {
  const openPosition = await positionGateway.getOpenPositionBySymbol(input.userId, input.symbol);

  if (input.direction === 'EXIT') {
    if (!openPosition) {
      return { status: 'ignored', reason: 'no_open_position' };
    }
    if (openPosition.managementMode === 'MANUAL_MANAGED') {
      return { status: 'ignored', reason: 'manual_managed_symbol' };
    }

    const closeSide = openPosition.side === 'LONG' ? 'SELL' : 'BUY';
    const closeOrder = await orderGateway.openOrder(input.userId, {
      botId: input.botId,
      symbol: input.symbol,
      side: closeSide,
      type: 'MARKET',
      quantity: openPosition.quantity,
      mode: input.mode,
      riskAck: true,
    });

    await positionGateway.closePosition(openPosition.id, input.userId);
    if (closeOrder.status === 'OPEN' || closeOrder.status === 'PARTIALLY_FILLED') {
      await orderGateway.closeOrder(input.userId, closeOrder.id, { riskAck: true });
    }

    return {
      status: 'closed',
      orderId: closeOrder.id,
      positionId: openPosition.id,
    };
  }

  if (openPosition) {
    if (openPosition.managementMode === 'MANUAL_MANAGED') {
      return { status: 'ignored', reason: 'manual_managed_symbol' };
    }
    if (openPosition.side !== directionToPositionSide(input.direction)) {
      return { status: 'ignored', reason: 'no_flip_with_open_position' };
    }
    return { status: 'ignored', reason: 'already_open_same_side' };
  }

  const openOrder = await orderGateway.openOrder(input.userId, {
    botId: input.botId,
    symbol: input.symbol,
    side: directionToOrderSide(input.direction),
    type: 'MARKET',
    quantity: input.quantity,
    mode: input.mode,
    riskAck: true,
  });

  const position = await positionGateway.createPosition({
    userId: input.userId,
    botId: input.botId,
    symbol: input.symbol,
    side: directionToPositionSide(input.direction),
    status: 'OPEN',
    entryPrice: input.markPrice,
    quantity: input.quantity,
    leverage: 1,
  });

  await orderGateway.linkOrderToPosition(openOrder.id, position.id);

  return {
    status: 'opened',
    orderId: openOrder.id,
    positionId: position.id,
  };
};
