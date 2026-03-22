import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../index';
import { prisma } from '../../prisma/client';

const registerAndLogin = async (email: string) => {
  const agent = request.agent(app);
  const res = await agent.post('/auth/register').send({
    email,
    password: 'test1234',
  });
  expect(res.status).toBe(201);
  return agent;
};

const getUserId = async (email: string) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return user.id;
};

describe('Orders and positions read contract', () => {
  beforeEach(async () => {
    await prisma.log.deleteMany();
    await prisma.backtestReport.deleteMany();
    await prisma.backtestTrade.deleteMany();
    await prisma.backtestRun.deleteMany();
    await prisma.trade.deleteMany();
    await prisma.order.deleteMany();
    await prisma.position.deleteMany();
    await prisma.signal.deleteMany();
    await prisma.botStrategy.deleteMany();
    await prisma.bot.deleteMany();
    await prisma.symbolGroup.deleteMany();
    await prisma.marketUniverse.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
  });

  it('rejects unauthenticated access', async () => {
    const ordersRes = await request(app).get('/dashboard/orders');
    expect(ordersRes.status).toBe(401);
    expect(ordersRes.body.error.message).toBe('Missing token');

    const positionsRes = await request(app).get('/dashboard/positions');
    expect(positionsRes.status).toBe(401);
    expect(positionsRes.body.error.message).toBe('Missing token');
  });

  it('lists and fetches only owner data for orders and positions', async () => {
    const ownerAgent = await registerAndLogin('read-owner@example.com');
    await registerAndLogin('read-other@example.com');

    const ownerId = await getUserId('read-owner@example.com');
    const otherId = await getUserId('read-other@example.com');

    const ownerPosition = await prisma.position.create({
      data: {
        userId: ownerId,
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: 60000,
        quantity: 0.1,
      },
    });

    await prisma.position.create({
      data: {
        userId: otherId,
        symbol: 'ETHUSDT',
        side: 'SHORT',
        entryPrice: 3000,
        quantity: 1.5,
      },
    });

    const ownerOrder = await prisma.order.create({
      data: {
        userId: ownerId,
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        status: 'OPEN',
        quantity: 0.1,
        price: 59500,
      },
    });

    await prisma.order.create({
      data: {
        userId: otherId,
        symbol: 'ETHUSDT',
        side: 'SELL',
        type: 'MARKET',
        status: 'FILLED',
        quantity: 1.5,
      },
    });

    const listPositionsRes = await ownerAgent.get('/dashboard/positions');
    expect(listPositionsRes.status).toBe(200);
    expect(listPositionsRes.body).toHaveLength(1);
    expect(listPositionsRes.body[0].id).toBe(ownerPosition.id);

    const getPositionRes = await ownerAgent.get(`/dashboard/positions/${ownerPosition.id}`);
    expect(getPositionRes.status).toBe(200);
    expect(getPositionRes.body.id).toBe(ownerPosition.id);

    const listOrdersRes = await ownerAgent.get('/dashboard/orders');
    expect(listOrdersRes.status).toBe(200);
    expect(listOrdersRes.body).toHaveLength(1);
    expect(listOrdersRes.body[0].id).toBe(ownerOrder.id);

    const getOrderRes = await ownerAgent.get(`/dashboard/orders/${ownerOrder.id}`);
    expect(getOrderRes.status).toBe(200);
    expect(getOrderRes.body.id).toBe(ownerOrder.id);
  });

  it('enforces ownership isolation for get by id', async () => {
    const ownerAgent = await registerAndLogin('read-owner-2@example.com');
    const otherAgent = await registerAndLogin('read-other-2@example.com');

    const ownerId = await getUserId('read-owner-2@example.com');

    const ownerPosition = await prisma.position.create({
      data: {
        userId: ownerId,
        symbol: 'SOLUSDT',
        side: 'LONG',
        entryPrice: 120,
        quantity: 10,
      },
    });

    const ownerOrder = await prisma.order.create({
      data: {
        userId: ownerId,
        symbol: 'SOLUSDT',
        side: 'BUY',
        type: 'LIMIT',
        status: 'OPEN',
        quantity: 10,
        price: 118,
      },
    });

    const otherPositionRes = await otherAgent.get(`/dashboard/positions/${ownerPosition.id}`);
    expect(otherPositionRes.status).toBe(404);
    expect(otherPositionRes.body.error.message).toBe('Not found');

    const otherOrderRes = await otherAgent.get(`/dashboard/orders/${ownerOrder.id}`);
    expect(otherOrderRes.status).toBe(404);
    expect(otherOrderRes.body.error.message).toBe('Not found');

    const ownerPositionRes = await ownerAgent.get(`/dashboard/positions/${ownerPosition.id}`);
    expect(ownerPositionRes.status).toBe(200);

    const ownerOrderRes = await ownerAgent.get(`/dashboard/orders/${ownerOrder.id}`);
    expect(ownerOrderRes.status).toBe(200);
  });

  it('supports open/cancel/close write endpoints with LIVE risk guards', async () => {
    const ownerAgent = await registerAndLogin('orders-write-owner@example.com');
    const ownerId = await getUserId('orders-write-owner@example.com');

    const liveWithoutAckRes = await ownerAgent.post('/dashboard/orders/open').send({
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'MARKET',
      quantity: 0.1,
      mode: 'LIVE',
      riskAck: false,
    });
    expect(liveWithoutAckRes.status).toBe(400);
    expect(liveWithoutAckRes.body.error.message).toBe('riskAck is required for LIVE order open');

    const liveBot = await prisma.bot.create({
      data: {
        userId: ownerId,
        name: 'Live Bot',
        mode: 'LIVE',
        marketType: 'FUTURES',
        positionMode: 'ONE_WAY',
        isActive: true,
        liveOptIn: true,
        consentTextVersion: 'mvp-v1',
        maxOpenPositions: 3,
      },
    });

    const openRes = await ownerAgent.post('/dashboard/orders/open').send({
      botId: liveBot.id,
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'LIMIT',
      quantity: 0.2,
      price: 62000,
      mode: 'LIVE',
      riskAck: true,
    });
    expect(openRes.status).toBe(201);
    expect(openRes.body.status).toBe('OPEN');

    const cancelWithoutAckRes = await ownerAgent
      .post(`/dashboard/orders/${openRes.body.id}/cancel`)
      .send({ riskAck: false });
    expect(cancelWithoutAckRes.status).toBe(400);
    expect(cancelWithoutAckRes.body.error.message).toBe('riskAck is required to cancel order');

    const cancelRes = await ownerAgent
      .post(`/dashboard/orders/${openRes.body.id}/cancel`)
      .send({ riskAck: true });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe('CANCELED');

    const position = await prisma.position.create({
      data: {
        userId: ownerId,
        symbol: 'ETHUSDT',
        side: 'LONG',
        status: 'OPEN',
        entryPrice: 3000,
        quantity: 1,
      },
    });

    const closableOrder = await prisma.order.create({
      data: {
        userId: ownerId,
        positionId: position.id,
        symbol: 'ETHUSDT',
        side: 'SELL',
        type: 'LIMIT',
        status: 'OPEN',
        quantity: 1,
        price: 3200,
      },
    });

    const closeRes = await ownerAgent
      .post(`/dashboard/orders/${closableOrder.id}/close`)
      .send({ riskAck: true });
    expect(closeRes.status).toBe(200);
    expect(closeRes.body.status).toBe('FILLED');

    const closedPosition = await prisma.position.findUniqueOrThrow({
      where: { id: position.id },
    });
    expect(closedPosition.status).toBe('CLOSED');
  });

  it('updates position management mode for owner and enforces ownership', async () => {
    const ownerAgent = await registerAndLogin('positions-mode-owner@example.com');
    const otherAgent = await registerAndLogin('positions-mode-other@example.com');
    const ownerId = await getUserId('positions-mode-owner@example.com');

    const position = await prisma.position.create({
      data: {
        userId: ownerId,
        symbol: 'BTCUSDT',
        side: 'LONG',
        status: 'OPEN',
        entryPrice: 63000,
        quantity: 0.05,
        managementMode: 'BOT_MANAGED',
        origin: 'BOT',
      },
    });

    const forbiddenRes = await otherAgent
      .patch(`/dashboard/positions/${position.id}/management-mode`)
      .send({ managementMode: 'MANUAL_MANAGED' });
    expect(forbiddenRes.status).toBe(404);
    expect(forbiddenRes.body.error.message).toBe('Not found');

    const updateRes = await ownerAgent
      .patch(`/dashboard/positions/${position.id}/management-mode`)
      .send({ managementMode: 'MANUAL_MANAGED' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.managementMode).toBe('MANUAL_MANAGED');

    const updated = await prisma.position.findUniqueOrThrow({
      where: { id: position.id },
    });
    expect(updated.managementMode).toBe('MANUAL_MANAGED');
  });
});
