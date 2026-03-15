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
    await prisma.trade.deleteMany();
    await prisma.order.deleteMany();
    await prisma.position.deleteMany();
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
});
