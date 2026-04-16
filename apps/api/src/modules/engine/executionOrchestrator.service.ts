import { Order, Position, PositionSide, Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { normalizeSymbol } from '../../lib/symbols';
import { closeOrder as closeOrderLifecycle, openOrder as openOrderLifecycle } from '../orders/orders.service';
import { decideExecutionAction } from './sharedExecutionCore';
import { runtimeTelemetryService } from './runtimeTelemetry.service';
import { invalidatePreTradeOpenPositionCountCache } from './preTrade.service';
import {
  buildCancelExecutionDedupeKey,
  buildCloseExecutionDedupeKey,
  buildOpenExecutionDedupeKey,
  runtimeExecutionDedupeService,
} from './runtimeExecutionDedupe.service';

export type RuntimeSignalDirection = 'LONG' | 'SHORT' | 'EXIT';
export type RuntimeExecutionMode = 'PAPER' | 'LIVE';

export type RuntimeSignalInput = {
  userId: string;
  botId?: string;
  walletId?: string;
  botMarketGroupId?: string;
  runtimeSessionId?: string;
  strategyId?: string;
  strategyInterval?: string;
  symbol: string;
  direction: RuntimeSignalDirection;
  quantity: number;
  markPrice: number;
  mode: RuntimeExecutionMode;
  candleOpenTime?: number;
  candleCloseTime?: number;
  reason?: string;
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
        | 'manual_managed_symbol'
        | 'dedupe_inflight'
        | 'dedupe_reused';
    };

export interface OrderFlowGateway {
  openOrder(userId: string, input: {
    botId?: string;
    walletId?: string;
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
  getOpenPositionBySymbol(input: {
    userId: string;
    symbol: string;
    mode: RuntimeExecutionMode;
    botId?: string;
    walletId?: string;
  }): Promise<Position | null>;
  createPosition(input: Prisma.PositionUncheckedCreateInput): Promise<Position>;
  closePosition(
    positionId: string,
    userId: string,
    payload?: {
      closedAt?: Date;
      realizedPnl?: number;
    }
  ): Promise<void>;
}

export const buildOpenPositionLookupWhere = (input: {
  userId: string;
  symbol: string;
  mode: RuntimeExecutionMode;
  botId?: string;
  walletId?: string;
}): Prisma.PositionWhereInput => {
  const normalizedSymbol = normalizeSymbol(input.symbol);
  const baseWhere: Prisma.PositionWhereInput = {
    userId: input.userId,
    symbol: normalizedSymbol,
    status: 'OPEN',
  };

  if (input.mode === 'LIVE') {
    if (input.walletId) {
      return {
        ...baseWhere,
        walletId: input.walletId,
      };
    }
    if (input.botId) {
      return {
        ...baseWhere,
        botId: input.botId,
      };
    }
    return baseWhere;
  }

  if (input.botId) {
    return {
      ...baseWhere,
      botId: input.botId,
    };
  }
  if (input.walletId) {
    return {
      ...baseWhere,
      walletId: input.walletId,
    };
  }
  return baseWhere;
};

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
    walletId?: string;
    strategyId?: string;
    orderId: string;
    positionId: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    price: number;
    quantity: number;
    fee?: number;
    feeSource?: 'ESTIMATED' | 'EXCHANGE_FILL';
    feePending?: boolean;
    feeCurrency?: string | null;
    effectiveFeeRate?: number | null;
    exchangeTradeId?: string | null;
    realizedPnl?: number;
    lifecycleAction?: 'OPEN' | 'DCA' | 'CLOSE' | 'UNKNOWN';
    origin?: 'BOT';
    managementMode?: 'BOT_MANAGED' | 'MANUAL_MANAGED';
  }): Promise<void>;
}

export interface RuntimeExecutionDedupeGateway {
  acquire(input: {
    dedupeKey: string;
    commandType: 'OPEN' | 'DCA' | 'CLOSE' | 'CANCEL';
    userId: string;
    botId?: string | null;
    symbol?: string | null;
    commandFingerprint: Record<string, unknown>;
    now?: Date;
  }): Promise<
    | {
        outcome: 'execute';
        dedupeKey: string;
      }
    | {
        outcome: 'reused';
        dedupeKey: string;
        orderId?: string | null;
        positionId?: string | null;
      }
    | {
        outcome: 'inflight';
        dedupeKey: string;
      }
  >;
  markSucceeded(input: {
    dedupeKey: string;
    orderId?: string | null;
    positionId?: string | null;
    now?: Date;
  }): Promise<void>;
  markFailed(input: {
    dedupeKey: string;
    errorClass: string;
    now?: Date;
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
  getOpenPositionBySymbol: (input) =>
    prisma.position.findFirst({
      where: buildOpenPositionLookupWhere(input),
      orderBy: { openedAt: 'desc' },
    }),
  createPosition: (input) => prisma.position.create({ data: input }),
  closePosition: async (positionId, userId, payload) => {
    const closedAt = payload?.closedAt ?? new Date();
    await prisma.position.updateMany({
      where: { id: positionId, userId, status: 'OPEN' },
      data: {
        status: 'CLOSED',
        closedAt,
        ...(typeof payload?.realizedPnl === 'number' && Number.isFinite(payload.realizedPnl)
          ? { realizedPnl: payload.realizedPnl }
          : {}),
        unrealizedPnl: 0,
      },
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
        walletId: input.walletId,
        strategyId: input.strategyId,
        orderId: input.orderId,
        positionId: input.positionId,
        symbol: input.symbol,
        side: input.side,
        lifecycleAction: input.lifecycleAction ?? 'UNKNOWN',
        price: input.price,
        quantity: input.quantity,
        fee: input.fee,
        feeSource: input.feeSource ?? 'ESTIMATED',
        feePending: input.feePending ?? false,
        feeCurrency: input.feeCurrency ?? null,
        effectiveFeeRate: input.effectiveFeeRate ?? null,
        exchangeTradeId: input.exchangeTradeId ?? null,
        realizedPnl: input.realizedPnl,
        origin: input.origin ?? 'BOT',
        managementMode: input.managementMode ?? 'BOT_MANAGED',
      },
    });
  },
};

const defaultRuntimeExecutionDedupeGateway: RuntimeExecutionDedupeGateway = {
  acquire: (input) => runtimeExecutionDedupeService.acquire(input),
  markSucceeded: (input) => runtimeExecutionDedupeService.markSucceeded(input),
  markFailed: (input) => runtimeExecutionDedupeService.markFailed(input),
};

const parseFeeRate = (value: string | undefined) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

const resolveRuntimeTakerFeeRate = (mode: RuntimeExecutionMode) => {
  const modeSpecific = parseFeeRate(
    mode === 'LIVE' ? process.env.RUNTIME_LIVE_TAKER_FEE_RATE : process.env.RUNTIME_PAPER_TAKER_FEE_RATE
  );
  if (modeSpecific != null) return modeSpecific;
  const global = parseFeeRate(process.env.RUNTIME_TAKER_FEE_RATE);
  if (global != null) return global;
  return 0.0004;
};

const computeTradeFee = (price: number, quantity: number, feeRate: number) => {
  if (!Number.isFinite(price) || !Number.isFinite(quantity) || !Number.isFinite(feeRate)) return 0;
  if (price <= 0 || quantity <= 0 || feeRate <= 0) return 0;
  return price * quantity * feeRate;
};

const resolveErrorClass = (error: unknown) => {
  if (error instanceof Error && error.name) return error.name;
  return 'runtime_execution_error';
};

export const orchestrateRuntimeSignal = async (
  input: RuntimeSignalInput,
  orderGateway: OrderFlowGateway = defaultOrderGateway,
  positionGateway: PositionFlowGateway = defaultPositionGateway,
  runtimeEventGateway: RuntimeExecutionEventGateway = defaultRuntimeEventGateway,
  runtimeTradeGateway: RuntimeTradeGateway = defaultRuntimeTradeGateway,
  dedupeGateway: RuntimeExecutionDedupeGateway = defaultRuntimeExecutionDedupeGateway
): Promise<OrchestrationResult> => {
  const feeRate = resolveRuntimeTakerFeeRate(input.mode);
  const openPosition = await positionGateway.getOpenPositionBySymbol({
    userId: input.userId,
    symbol: input.symbol,
    mode: input.mode,
    botId: input.botId,
    walletId: input.walletId,
  });
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
    const closeDedupeKey = buildCloseExecutionDedupeKey({
      userId: input.userId,
      botId: input.botId,
      symbol: input.symbol,
      positionId: openPosition.id,
      closeReason: input.reason,
    });
    const closeDedupe = await dedupeGateway.acquire({
      dedupeKey: closeDedupeKey,
      commandType: 'CLOSE',
      userId: input.userId,
      botId: input.botId,
      symbol: input.symbol,
      commandFingerprint: {
        positionId: openPosition.id,
        symbol: normalizeSymbol(input.symbol),
        closeReason: input.reason ?? 'EXIT',
        direction: input.direction,
      },
    });
    if (closeDedupe.outcome === 'inflight') {
      await runtimeEventGateway.writeEvent({
        userId: input.userId,
        botId: input.botId,
        strategyId: input.strategyId,
        symbol: input.symbol,
        direction: input.direction,
        mode: input.mode,
        runtimeSessionId: input.runtimeSessionId,
        status: 'ignored',
        reason: 'dedupe_inflight',
      });
      return { status: 'ignored', reason: 'dedupe_inflight' };
    }
    if (closeDedupe.outcome === 'reused') {
      if (closeDedupe.orderId && closeDedupe.positionId) {
        return {
          status: 'closed',
          orderId: closeDedupe.orderId,
          positionId: closeDedupe.positionId,
        };
      }
      return { status: 'ignored', reason: 'dedupe_reused' };
    }

    try {
    const closeEventAt = new Date();
    const estimatedExitFee = computeTradeFee(input.markPrice, openPosition.quantity, feeRate);
    const entryLegSide = openPosition.side === 'LONG' ? 'BUY' : 'SELL';
    const entryFeeAggregate = await prisma.trade.aggregate({
      where: {
        userId: input.userId,
        botId: input.botId,
        walletId: openPosition.walletId,
        positionId: openPosition.id,
        side: entryLegSide,
      },
      _sum: {
        fee: true,
      },
    });
    const entryFees = entryFeeAggregate._sum.fee ?? 0;
    const grossPnl =
      openPosition.side === 'LONG'
        ? (input.markPrice - openPosition.entryPrice) * openPosition.quantity
        : (openPosition.entryPrice - input.markPrice) * openPosition.quantity;

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
    const exitFee = input.mode === 'LIVE' ? (closeOrder.fee ?? estimatedExitFee) : estimatedExitFee;
    const realizedPnl = grossPnl - entryFees - exitFee;

    await positionGateway.closePosition(openPosition.id, input.userId, {
      closedAt: closeEventAt,
      realizedPnl,
    });
    if (closeOrder.status === 'OPEN' || closeOrder.status === 'PARTIALLY_FILLED') {
      const cancelDedupeKey = buildCancelExecutionDedupeKey({
        userId: input.userId,
        botId: input.botId,
        symbol: input.symbol,
        orderId: closeOrder.id,
        reasonCode: 'runtime_close_finalize',
      });
      const cancelDedupe = await dedupeGateway.acquire({
        dedupeKey: cancelDedupeKey,
        commandType: 'CANCEL',
        userId: input.userId,
        botId: input.botId,
        symbol: input.symbol,
        commandFingerprint: {
          orderId: closeOrder.id,
          reasonCode: 'runtime_close_finalize',
        },
      });
      if (cancelDedupe.outcome === 'execute') {
        try {
          await orderGateway.closeOrder(input.userId, closeOrder.id, { riskAck: true });
          await dedupeGateway.markSucceeded({
            dedupeKey: cancelDedupeKey,
            orderId: closeOrder.id,
            positionId: openPosition.id,
          });
        } catch (error) {
          await dedupeGateway.markFailed({
            dedupeKey: cancelDedupeKey,
            errorClass: resolveErrorClass(error),
          });
          throw error;
        }
      }
    }
    await runtimeTradeGateway.createTrade({
      userId: input.userId,
      botId: input.botId,
      walletId: openPosition.walletId ?? input.walletId,
      strategyId: input.strategyId,
      orderId: closeOrder.id,
      positionId: openPosition.id,
      symbol: input.symbol,
      side: decision.orderSide,
      price: input.markPrice,
      quantity: openPosition.quantity,
      fee: exitFee,
      feeSource: closeOrder.feeSource,
      feePending: closeOrder.feePending,
      feeCurrency: closeOrder.feeCurrency,
      effectiveFeeRate: closeOrder.effectiveFeeRate,
      exchangeTradeId: closeOrder.exchangeTradeId,
      realizedPnl,
      lifecycleAction: 'CLOSE',
      managementMode: openPosition.managementMode as 'BOT_MANAGED' | 'MANUAL_MANAGED',
    });
    if (input.botId) {
      await runtimeTelemetryService.upsertRuntimeSymbolStat({
        userId: input.userId,
        botId: input.botId,
        mode: input.mode,
        sessionId: input.runtimeSessionId,
        symbol: input.symbol,
        increments: {
          realizedPnl,
          feesPaid: exitFee,
          ...(realizedPnl >= 0
            ? { grossProfit: realizedPnl, winningTrades: 1 }
            : { grossLoss: Math.abs(realizedPnl), losingTrades: 1 }),
        },
        lastTradeAt: closeEventAt,
      });
    }

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
      reason: input.reason,
      eventAt: closeEventAt,
    });
    await dedupeGateway.markSucceeded({
      dedupeKey: closeDedupeKey,
      orderId: closeOrder.id,
      positionId: openPosition.id,
    });
    invalidatePreTradeOpenPositionCountCache({
      userId: input.userId,
      botId: input.botId,
    });

    return {
      status: 'closed',
      orderId: closeOrder.id,
      positionId: openPosition.id,
    };
    } catch (error) {
      await dedupeGateway.markFailed({
        dedupeKey: closeDedupeKey,
        errorClass: resolveErrorClass(error),
      });
      throw error;
    }
  }

  const hasOpenDedupeContext =
    Boolean(input.botId) &&
    Boolean(input.botMarketGroupId) &&
    Boolean(input.strategyInterval) &&
    Number.isFinite(input.candleOpenTime as number) &&
    Number.isFinite(input.candleCloseTime as number);
  const openDedupeKey = hasOpenDedupeContext
    ? buildOpenExecutionDedupeKey({
        userId: input.userId,
        botId: input.botId!,
        botMarketGroupId: input.botMarketGroupId!,
        symbol: input.symbol,
        interval: input.strategyInterval!,
        candleOpenTime: Number(input.candleOpenTime),
        candleCloseTime: Number(input.candleCloseTime),
        direction: input.direction as 'LONG' | 'SHORT',
      })
    : null;
  if (openDedupeKey) {
    const openDedupe = await dedupeGateway.acquire({
      dedupeKey: openDedupeKey,
      commandType: 'OPEN',
      userId: input.userId,
      botId: input.botId,
      symbol: input.symbol,
      commandFingerprint: {
        botMarketGroupId: input.botMarketGroupId,
        interval: input.strategyInterval,
        candleOpenTime: input.candleOpenTime,
        candleCloseTime: input.candleCloseTime,
        direction: input.direction,
      },
    });
    if (openDedupe.outcome === 'inflight') {
      await runtimeEventGateway.writeEvent({
        userId: input.userId,
        botId: input.botId,
        strategyId: input.strategyId,
        symbol: input.symbol,
        direction: input.direction,
        mode: input.mode,
        runtimeSessionId: input.runtimeSessionId,
        status: 'ignored',
        reason: 'dedupe_inflight',
      });
      return { status: 'ignored', reason: 'dedupe_inflight' };
    }
    if (openDedupe.outcome === 'reused') {
      if (openDedupe.orderId && openDedupe.positionId) {
        return {
          status: 'opened',
          orderId: openDedupe.orderId,
          positionId: openDedupe.positionId,
        };
      }
      return { status: 'ignored', reason: 'dedupe_reused' };
    }
  }

  try {
  const openOrder = await orderGateway.openOrder(input.userId, {
    botId: input.botId,
    walletId: input.walletId,
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
    walletId: input.walletId,
    strategyId: input.strategyId,
    symbol: input.symbol,
    side: decision.positionSide as PositionSide,
    status: 'OPEN',
    entryPrice: input.markPrice,
    quantity: input.quantity,
    leverage: Math.max(1, strategyLeverage),
  });

  await orderGateway.linkOrderToPosition(openOrder.id, position.id);
  const openEventAt = new Date();
  const estimatedOpenFee = computeTradeFee(input.markPrice, input.quantity, feeRate);
  const openFee = input.mode === 'LIVE' ? (openOrder.fee ?? estimatedOpenFee) : estimatedOpenFee;
  await runtimeTradeGateway.createTrade({
    userId: input.userId,
    botId: input.botId,
    walletId: input.walletId,
    strategyId: input.strategyId,
    orderId: openOrder.id,
    positionId: position.id,
    symbol: input.symbol,
    side: decision.orderSide,
    price: input.markPrice,
    quantity: input.quantity,
    fee: openFee,
    feeSource: openOrder.feeSource,
    feePending: openOrder.feePending,
    feeCurrency: openOrder.feeCurrency,
    effectiveFeeRate: openOrder.effectiveFeeRate,
    exchangeTradeId: openOrder.exchangeTradeId,
    realizedPnl: 0,
    lifecycleAction: 'OPEN',
    managementMode: 'BOT_MANAGED',
  });
  if (input.botId) {
    await runtimeTelemetryService.upsertRuntimeSymbolStat({
      userId: input.userId,
      botId: input.botId,
      mode: input.mode,
      sessionId: input.runtimeSessionId,
      symbol: input.symbol,
      increments: {
        feesPaid: openFee,
      },
      lastTradeAt: openEventAt,
    });
  }
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
    eventAt: openEventAt,
  });
  if (openDedupeKey) {
    await dedupeGateway.markSucceeded({
      dedupeKey: openDedupeKey,
      orderId: openOrder.id,
      positionId: position.id,
    });
  }
  invalidatePreTradeOpenPositionCountCache({
    userId: input.userId,
    botId: input.botId,
  });

  return {
    status: 'opened',
    orderId: openOrder.id,
    positionId: position.id,
  };
  } catch (error) {
    if (openDedupeKey) {
      await dedupeGateway.markFailed({
        dedupeKey: openDedupeKey,
        errorClass: resolveErrorClass(error),
      });
    }
    throw error;
  }
};
