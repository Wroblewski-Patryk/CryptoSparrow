import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { CancelOrderDto, CloseOrderDto, ListOrdersQuery, OpenOrderDto } from './orders.types';

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

const ensureLiveOrderAllowed = async (userId: string, payload: OpenOrderDto) => {
  if (payload.mode !== 'LIVE') return;
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
      liveOptIn: true,
      isActive: true,
      consentTextVersion: true,
    },
  });

  if (!bot) throw new Error('LIVE_BOT_NOT_FOUND');
  if (bot.mode !== 'LIVE') throw new Error('LIVE_BOT_MODE_REQUIRED');
  if (!bot.liveOptIn || !bot.consentTextVersion) throw new Error('LIVE_BOT_OPT_IN_REQUIRED');
  if (!bot.isActive) throw new Error('LIVE_BOT_ACTIVE_REQUIRED');
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

export const openOrder = async (userId: string, payload: OpenOrderDto) => {
  await ensureLiveOrderAllowed(userId, payload);

  const now = new Date();
  const isMarket = payload.type === 'MARKET';
  const status = isMarket ? 'FILLED' : 'OPEN';

  const order = await prisma.order.create({
    data: {
      userId,
      botId: payload.botId,
      symbol: payload.symbol.toUpperCase(),
      side: payload.side,
      type: payload.type,
      status,
      quantity: payload.quantity,
      filledQuantity: isMarket ? payload.quantity : 0,
      price: payload.price,
      submittedAt: now,
      filledAt: isMarket ? now : null,
    },
  });

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
