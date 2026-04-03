import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { CancelOrderDto, CloseOrderDto, ListOrdersQuery, OpenOrderDto } from './orders.types';
import { decrypt } from '../../utils/crypto';
import { CcxtFuturesConnector } from '../exchange/ccxtFuturesConnector.service';
import { createLiveOrderAdapter } from '../exchange/liveOrderAdapter.service';
import { CcxtFuturesOrderFill } from '../exchange/ccxtFuturesConnector.types';

export const listOrders = async (userId: string, query: ListOrdersQuery) => {
  const skip = (query.page - 1) * query.limit;
  const where = {
    userId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.symbol ? { symbol: query.symbol } : {}),
  };

  return prisma.order.findMany({
    where,
    skip,
    take: query.limit,
    orderBy: { createdAt: 'desc' },
  });
};

export const getOrder = async (userId: string, id: string) => {
  return prisma.order.findFirst({
    where: { id, userId },
  });
};

type LiveBotContext = {
  id: string;
  marketType: 'FUTURES' | 'SPOT';
  positionMode: 'ONE_WAY' | 'HEDGE';
};

type LiveExecutionResult = {
  exchangeOrderId: string | null;
  status: 'OPEN' | 'FILLED';
  fee?: number | null;
  feeSource?: 'ESTIMATED' | 'EXCHANGE_FILL';
  feePending?: boolean;
  feeCurrency?: string | null;
  effectiveFeeRate?: number | null;
  exchangeTradeId?: string | null;
  fills?: CcxtFuturesOrderFill[];
};

type OpenOrderDeps = {
  executeLiveOrder: (params: {
    userId: string;
    bot: LiveBotContext;
    payload: OpenOrderDto;
  }) => Promise<LiveExecutionResult>;
};

const mapLiveOrderType = (type: OpenOrderDto['type']) => {
  if (type === 'MARKET') return 'market' as const;
  if (type === 'LIMIT') return 'limit' as const;
  throw new Error('LIVE_ORDER_TYPE_UNSUPPORTED');
};

const mapLiveOrderStatus = (status: string | undefined, fallbackType: OpenOrderDto['type']) => {
  if (status) {
    const normalized = status.toLowerCase();
    if (normalized.includes('filled') || normalized.includes('closed')) return 'FILLED' as const;
  }
  return fallbackType === 'MARKET' ? ('FILLED' as const) : ('OPEN' as const);
};

const ensureLiveOrderAllowed = async (
  userId: string,
  payload: OpenOrderDto
): Promise<LiveBotContext | null> => {
  if (payload.mode !== 'LIVE') return null;
  if (!payload.riskAck) {
    throw new Error('LIVE_RISK_ACK_REQUIRED');
  }
  if (!payload.botId) {
    throw new Error('LIVE_BOT_REQUIRED');
  }

  const bot = await prisma.bot.findFirst({
    where: { id: payload.botId, userId },
    select: {
      id: true,
      mode: true,
      marketType: true,
      positionMode: true,
      liveOptIn: true,
      isActive: true,
      consentTextVersion: true,
    },
  });

  if (!bot) throw new Error('LIVE_BOT_NOT_FOUND');
  if (bot.mode !== 'LIVE') throw new Error('LIVE_BOT_MODE_REQUIRED');
  if (!bot.liveOptIn || !bot.consentTextVersion) throw new Error('LIVE_BOT_OPT_IN_REQUIRED');
  if (!bot.isActive) throw new Error('LIVE_BOT_ACTIVE_REQUIRED');

  return {
    id: bot.id,
    marketType: bot.marketType,
    positionMode: bot.positionMode,
  };
};

const executeLiveOrderOnExchange: OpenOrderDeps['executeLiveOrder'] = async (params) => {
  const apiKey = await prisma.apiKey.findFirst({
    where: { userId: params.userId, exchange: 'BINANCE' },
    orderBy: { updatedAt: 'desc' },
  });

  if (!apiKey) {
    throw new Error('LIVE_API_KEY_REQUIRED');
  }

  const connector = new CcxtFuturesConnector({
    exchangeId: 'binance',
    apiKey: decrypt(apiKey.apiKey),
    secret: decrypt(apiKey.apiSecret),
    marketType: params.bot.marketType,
  });

  const liveAdapter = createLiveOrderAdapter(connector);
  try {
    const result = await liveAdapter.placeLiveOrderWithFees({
      order: {
        symbol: params.payload.symbol.toUpperCase(),
        side: params.payload.side === 'BUY' ? 'buy' : 'sell',
        type: mapLiveOrderType(params.payload.type),
        amount: params.payload.quantity,
        price: params.payload.price,
        positionMode: params.bot.positionMode,
      },
    });

    return {
      exchangeOrderId: result.exchangeOrderId,
      status: mapLiveOrderStatus(result.rawOrderStatus ?? result.status, params.payload.type),
      fee: result.fee,
      feeSource: result.feeSource,
      feePending: result.feePending,
      feeCurrency: result.feeCurrency,
      effectiveFeeRate: result.effectiveFeeRate,
      exchangeTradeId: result.exchangeTradeId,
      fills: result.fills,
    };
  } catch {
    throw new Error('LIVE_EXECUTION_FAILED');
  } finally {
    await connector.disconnect().catch(() => undefined);
  }
};

const defaultOpenOrderDeps: OpenOrderDeps = {
  executeLiveOrder: executeLiveOrderOnExchange,
};

const writeOrderAudit = async (params: {
  userId: string;
  orderId: string;
  action: 'order.opened' | 'order.canceled' | 'order.closed';
  level: 'INFO' | 'WARN';
  metadata?: Record<string, unknown>;
}) => {
  try {
    await prisma.log.create({
      data: {
        userId: params.userId,
        action: params.action,
        level: params.level,
        source: 'orders.service',
        message: `Order lifecycle event: ${params.action}`,
        category: 'TRADING_DECISION',
        entityType: 'ORDER',
        entityId: params.orderId,
        metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch {
    // Audit failures should not block order lifecycle.
  }
};

export const openOrder = async (
  userId: string,
  payload: OpenOrderDto,
  deps: OpenOrderDeps = defaultOpenOrderDeps
) => {
  const liveBot = await ensureLiveOrderAllowed(userId, payload);

  const now = new Date();
  let exchangeOrderId: string | null = null;
  let exchangeTradeId: string | null = null;
  let status: 'OPEN' | 'FILLED' = payload.type === 'MARKET' ? 'FILLED' : 'OPEN';
  let fee: number | null = null;
  let feeSource: 'ESTIMATED' | 'EXCHANGE_FILL' = 'ESTIMATED';
  let feePending = payload.mode === 'LIVE';
  let feeCurrency: string | null = null;
  let effectiveFeeRate: number | null = null;
  let fills: CcxtFuturesOrderFill[] = [];

  if (payload.mode === 'LIVE' && process.env.NODE_ENV !== 'test') {
    if (!liveBot) {
      throw new Error('LIVE_BOT_NOT_FOUND');
    }
    const liveResult = await deps.executeLiveOrder({
      userId,
      bot: liveBot,
      payload,
    });
    exchangeOrderId = liveResult.exchangeOrderId;
    status = liveResult.status;
    exchangeTradeId = liveResult.exchangeTradeId ?? null;
    fee = typeof liveResult.fee === 'number' ? liveResult.fee : null;
    feeSource = liveResult.feeSource ?? 'ESTIMATED';
    feePending = liveResult.feePending ?? false;
    feeCurrency = liveResult.feeCurrency ?? null;
    effectiveFeeRate =
      typeof liveResult.effectiveFeeRate === 'number' ? liveResult.effectiveFeeRate : null;
    fills = Array.isArray(liveResult.fills) ? liveResult.fills : [];
  }

  const order = await prisma.order.create({
    data: {
      userId,
      botId: payload.botId,
      strategyId: payload.strategyId,
      symbol: payload.symbol.toUpperCase(),
      side: payload.side,
      type: payload.type,
      status,
      quantity: payload.quantity,
      filledQuantity: status === 'FILLED' ? payload.quantity : 0,
      price: payload.price,
      fee,
      feeSource,
      feePending,
      feeCurrency,
      effectiveFeeRate,
      exchangeOrderId,
      exchangeTradeId,
      submittedAt: now,
      filledAt: status === 'FILLED' ? now : null,
    },
  });

  if (payload.mode === 'LIVE' && fills.length > 0) {
    await prisma.orderFill.createMany({
      data: fills.map((fill) => ({
        userId,
        botId: payload.botId ?? null,
        strategyId: payload.strategyId ?? null,
        orderId: order.id,
        tradeId: null,
        positionId: null,
        symbol: fill.symbol,
        side: payload.side,
        exchangeTradeId:
          fill.exchangeTradeId ?? `${exchangeOrderId ?? order.id}-${fill.executedAt?.toISOString() ?? 'na'}`,
        price: fill.price,
        quantity: fill.quantity,
        notional: fill.notional,
        feeCost: typeof fill.feeCost === 'number' ? fill.feeCost : null,
        feeCurrency: fill.feeCurrency,
        feeRate: fill.feeRate,
        executedAt: fill.executedAt ?? now,
        raw: (fill.raw ?? {}) as Prisma.InputJsonValue,
      })),
    });
  }

  await writeOrderAudit({
    userId,
    orderId: order.id,
    action: 'order.opened',
    level: 'INFO',
    metadata: {
      mode: payload.mode,
      riskAck: payload.riskAck,
      type: payload.type,
      status: order.status,
      exchangeOrderId: order.exchangeOrderId,
    },
  });

  return order;
};

export const cancelOrder = async (userId: string, id: string, payload: CancelOrderDto) => {
  const existing = await prisma.order.findFirst({
    where: { id, userId },
  });
  if (!existing) return null;

  if (existing.status === 'CANCELED' || existing.status === 'FILLED') {
    throw new Error('ORDER_NOT_CANCELABLE');
  }

  if (!payload.riskAck) {
    throw new Error('ORDER_CANCEL_RISK_ACK_REQUIRED');
  }

  const updated = await prisma.order.update({
    where: { id: existing.id },
    data: {
      status: 'CANCELED',
      canceledAt: new Date(),
    },
  });

  await writeOrderAudit({
    userId,
    orderId: updated.id,
    action: 'order.canceled',
    level: 'WARN',
    metadata: {
      previousStatus: existing.status,
      riskAck: payload.riskAck,
    },
  });

  return updated;
};

export const closeOrder = async (userId: string, id: string, payload: CloseOrderDto) => {
  const existing = await prisma.order.findFirst({
    where: { id, userId },
  });
  if (!existing) return null;

  if (!payload.riskAck) {
    throw new Error('ORDER_CLOSE_RISK_ACK_REQUIRED');
  }

  if (existing.status !== 'OPEN' && existing.status !== 'PARTIALLY_FILLED') {
    throw new Error('ORDER_NOT_CLOSABLE');
  }

  const now = new Date();
  const updated = await prisma.order.update({
    where: { id: existing.id },
    data: {
      status: 'FILLED',
      filledQuantity: existing.quantity,
      filledAt: now,
    },
  });

  if (existing.positionId) {
    await prisma.position.updateMany({
      where: {
        id: existing.positionId,
        userId,
        status: 'OPEN',
      },
      data: {
        status: 'CLOSED',
        closedAt: now,
      },
    });
  }

  await writeOrderAudit({
    userId,
    orderId: updated.id,
    action: 'order.closed',
    level: 'INFO',
    metadata: {
      previousStatus: existing.status,
      riskAck: payload.riskAck,
    },
  });

  return updated;
};
