import { Order, Position, PositionSide, Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { closeOrder as closeOrderLifecycle, openOrder as openOrderLifecycle } from '../orders/orders.service';
import { decideExecutionAction } from './sharedExecutionCore';
import { runtimeTelemetryService } from './runtimeTelemetry.service';

export type RuntimeSignalDirection = 'LONG' | 'SHORT' | 'EXIT';
export type RuntimeExecutionMode = 'PAPER' | 'LIVE';

export type RuntimeSignalInput = {
  userId: string;
  botId?: string;
  runtimeSessionId?: string;
  strategyId?: string;
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
    strategyId?: string;
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

export interface RuntimeExecutionEventGateway {
  writeEvent(input: {
    userId: string;
    botId?: string;
    strategyId?: string;
    symbol: string;
    direction: RuntimeSignalDirection;
    mode: RuntimeExecutionMode;
    runtimeSessionId?: string;
    status: 'ignored' | 'opened' | 'closed';
    reason?: string;
    orderId?: string;
    positionId?: string;
    positionQty?: number;
    lastPrice?: number;
    eventAt?: Date;
  }): Promise<void>;
}

export interface RuntimeTradeGateway {
  createTrade(input: {
    userId: string;
    botId?: string;
    strategyId?: string;
    orderId: string;
    positionId: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    price: number;
    quantity: number;
    origin?: 'BOT';
    managementMode?: 'BOT_MANAGED' | 'MANUAL_MANAGED';
  }): Promise<void>;
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

const defaultRuntimeEventGateway: RuntimeExecutionEventGateway = {
  writeEvent: async (input) => {
    const eventAt = input.eventAt ?? new Date();
    const metadata = {
      symbol: input.symbol,
      direction: input.direction,
      mode: input.mode,
      status: input.status,
      reason: input.reason ?? null,
      orderId: input.orderId ?? null,
      positionId: input.positionId ?? null,
      positionQty: input.positionQty ?? null,
      lastPrice: input.lastPrice ?? null,
    } as Prisma.InputJsonValue;

    await prisma.log.create({
      data: {
        userId: input.userId,
        botId: input.botId,
        strategyId: input.strategyId,
        action: 'runtime.execution',
        level: 'INFO',
        source: 'engine.executionOrchestrator',
        message: `Runtime execution ${input.status} for ${input.symbol} (${input.direction})`,
        category: 'runtime',
        entityType: 'position',
        entityId: input.positionId,
        actor: 'runtime',
        metadata,
      },
    });

    if (!input.botId) return;

    const eventType =
      input.status === 'opened'
        ? 'POSITION_OPENED'
        : input.status === 'closed'
          ? 'POSITION_CLOSED'
          : 'SIGNAL_DECISION';

    await runtimeTelemetryService.recordRuntimeEvent({
      userId: input.userId,
      botId: input.botId,
      mode: input.mode,
      sessionId: input.runtimeSessionId,
      eventType,
      level: input.status === 'ignored' ? 'DEBUG' : 'INFO',
      symbol: input.symbol,
      strategyId: input.strategyId,
      signalDirection: input.direction,
      message:
        input.status === 'ignored'
          ? `Decision ignored (${input.reason ?? 'n/a'}) for ${input.symbol}`
          : `Runtime execution ${input.status} for ${input.symbol} (${input.direction})`,
      payload: metadata as unknown as Record<string, unknown>,
      eventAt,
    });

    const increments =
      input.status === 'closed'
        ? {
            closedTrades: 1,
          }
        : undefined;

    const isTradeEvent = input.status === 'opened' || input.status === 'closed';
    const openPositionCount = input.status === 'opened' ? 1 : input.status === 'closed' ? 0 : undefined;
    const openPositionQty =
      input.status === 'opened'
        ? Math.max(0, input.positionQty ?? 0)
        : input.status === 'closed'
          ? 0
          : undefined;

    await runtimeTelemetryService.upsertRuntimeSymbolStat({
      userId: input.userId,
      botId: input.botId,
      mode: input.mode,
      sessionId: input.runtimeSessionId,
      symbol: input.symbol,
      increments,
      lastPrice: input.lastPrice,
      lastTradeAt: isTradeEvent ? eventAt : undefined,
      openPositionCount,
      openPositionQty,
    });
  },
};

const defaultRuntimeTradeGateway: RuntimeTradeGateway = {
  createTrade: async (input) => {
    await prisma.trade.create({
      data: {
        userId: input.userId,
        botId: input.botId,
        strategyId: input.strategyId,
        orderId: input.orderId,
        positionId: input.positionId,
        symbol: input.symbol,
        side: input.side,
        price: input.price,
        quantity: input.quantity,
        origin: input.origin ?? 'BOT',
        managementMode: input.managementMode ?? 'BOT_MANAGED',
      },
    });
  },
};

export const orchestrateRuntimeSignal = async (
  input: RuntimeSignalInput,
  orderGateway: OrderFlowGateway = defaultOrderGateway,
  positionGateway: PositionFlowGateway = defaultPositionGateway,
  runtimeEventGateway: RuntimeExecutionEventGateway = defaultRuntimeEventGateway,
  runtimeTradeGateway: RuntimeTradeGateway = defaultRuntimeTradeGateway
): Promise<OrchestrationResult> => {
  const openPosition = await positionGateway.getOpenPositionBySymbol(input.userId, input.symbol);
  const decision = decideExecutionAction(
    input.direction,
    openPosition
      ? {
          side: openPosition.side as 'LONG' | 'SHORT',
          quantity: openPosition.quantity,
          managementMode: openPosition.managementMode as 'BOT_MANAGED' | 'MANUAL_MANAGED',
        }
      : null
  );

  if (decision.kind === 'ignore') {
    await runtimeEventGateway.writeEvent({
      userId: input.userId,
      botId: input.botId,
      strategyId: input.strategyId,
      symbol: input.symbol,
      direction: input.direction,
      mode: input.mode,
      runtimeSessionId: input.runtimeSessionId,
      status: 'ignored',
      reason: decision.reason,
    });
    return { status: 'ignored', reason: decision.reason };
  }

  if (decision.kind === 'close') {
    if (!openPosition) {
      await runtimeEventGateway.writeEvent({
        userId: input.userId,
        botId: input.botId,
        strategyId: input.strategyId,
        symbol: input.symbol,
        direction: input.direction,
        mode: input.mode,
        runtimeSessionId: input.runtimeSessionId,
        status: 'ignored',
        reason: 'no_open_position',
      });
      return { status: 'ignored', reason: 'no_open_position' };
    }
    const closeOrder = await orderGateway.openOrder(input.userId, {
      botId: input.botId,
      strategyId: input.strategyId,
      symbol: input.symbol,
      side: decision.orderSide,
      type: 'MARKET',
      quantity: openPosition.quantity,
      mode: input.mode,
      riskAck: true,
    });

    await positionGateway.closePosition(openPosition.id, input.userId);
    if (closeOrder.status === 'OPEN' || closeOrder.status === 'PARTIALLY_FILLED') {
      await orderGateway.closeOrder(input.userId, closeOrder.id, { riskAck: true });
    }
    await runtimeTradeGateway.createTrade({
      userId: input.userId,
      botId: input.botId,
      strategyId: input.strategyId,
      orderId: closeOrder.id,
      positionId: openPosition.id,
      symbol: input.symbol,
      side: decision.orderSide,
      price: input.markPrice,
      quantity: openPosition.quantity,
      managementMode: openPosition.managementMode as 'BOT_MANAGED' | 'MANUAL_MANAGED',
    });

    await runtimeEventGateway.writeEvent({
      userId: input.userId,
      botId: input.botId,
      strategyId: input.strategyId,
      symbol: input.symbol,
      direction: input.direction,
      mode: input.mode,
      runtimeSessionId: input.runtimeSessionId,
      status: 'closed',
      orderId: closeOrder.id,
      positionId: openPosition.id,
      positionQty: openPosition.quantity,
      lastPrice: input.markPrice,
      eventAt: new Date(),
    });

    return {
      status: 'closed',
      orderId: closeOrder.id,
      positionId: openPosition.id,
    };
  }

  const openOrder = await orderGateway.openOrder(input.userId, {
    botId: input.botId,
    strategyId: input.strategyId,
    symbol: input.symbol,
    side: decision.orderSide,
    type: 'MARKET',
    quantity: input.quantity,
    mode: input.mode,
    riskAck: true,
  });

  const strategyLeverage =
    input.strategyId
      ? (
          await prisma.strategy.findFirst({
            where: { id: input.strategyId, userId: input.userId },
            select: { leverage: true },
          })
        )?.leverage ?? 1
      : 1;

  const position = await positionGateway.createPosition({
    userId: input.userId,
    botId: input.botId,
    strategyId: input.strategyId,
    symbol: input.symbol,
    side: decision.positionSide as PositionSide,
    status: 'OPEN',
    entryPrice: input.markPrice,
    quantity: input.quantity,
    leverage: Math.max(1, strategyLeverage),
  });

  await orderGateway.linkOrderToPosition(openOrder.id, position.id);
  await runtimeTradeGateway.createTrade({
    userId: input.userId,
    botId: input.botId,
    strategyId: input.strategyId,
    orderId: openOrder.id,
    positionId: position.id,
    symbol: input.symbol,
    side: decision.orderSide,
    price: input.markPrice,
    quantity: input.quantity,
    managementMode: 'BOT_MANAGED',
  });
  await runtimeEventGateway.writeEvent({
    userId: input.userId,
    botId: input.botId,
    strategyId: input.strategyId,
    symbol: input.symbol,
    direction: input.direction,
    mode: input.mode,
    runtimeSessionId: input.runtimeSessionId,
    status: 'opened',
    orderId: openOrder.id,
    positionId: position.id,
    positionQty: input.quantity,
    lastPrice: input.markPrice,
    eventAt: new Date(),
  });

  return {
    status: 'opened',
    orderId: openOrder.id,
    positionId: position.id,
  };
};
