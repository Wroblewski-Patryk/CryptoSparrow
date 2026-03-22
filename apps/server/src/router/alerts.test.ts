import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../index';
import { metricsStore } from '../observability/metrics';
import { prisma } from '../prisma/client';

const originalMarketDataAt = process.env.WORKER_LAST_MARKET_DATA_AT;
const originalHeartbeatAt = process.env.WORKER_LAST_HEARTBEAT_AT;

afterEach(() => {
  process.env.WORKER_LAST_MARKET_DATA_AT = originalMarketDataAt;
  process.env.WORKER_LAST_HEARTBEAT_AT = originalHeartbeatAt;
  metricsStore.setWorkerQueueLag('marketData', 0);
  metricsStore.setWorkerQueueLag('backtest', 0);
  metricsStore.setWorkerQueueLag('execution', 0);
});

const createAdminAgent = async () => {
  const email = `alerts-admin-${Date.now()}-${Math.random()}@example.com`;
  const agent = request.agent(app);
  const registerRes = await agent.post('/auth/register').send({
    email,
    password: 'Admin12#$',
  });
  expect(registerRes.status).toBe(201);

  await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN' },
  });

  const loginRes = await agent.post('/auth/login').send({
    email,
    password: 'Admin12#$',
  });
  expect(loginRes.status).toBe(200);
  return agent;
};

describe('alerts endpoint', () => {
  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/alerts');
    expect(res.status).toBe(401);
  });

  it('returns alerts for failure spike, staleness, and missing heartbeat', async () => {
    const adminAgent = await createAdminAgent();
    metricsStore.recordExchangeOrderFailure();
    metricsStore.recordExchangeOrderFailure();
    metricsStore.recordExchangeOrderFailure();
    metricsStore.setWorkerQueueLag('marketData', 150);

    process.env.WORKER_LAST_MARKET_DATA_AT = '2000-01-01T00:00:00.000Z';
    process.env.WORKER_LAST_HEARTBEAT_AT = '2000-01-01T00:00:00.000Z';

    const res = await adminAgent.get('/alerts');
    expect(res.status).toBe(200);

    const codes = (res.body.alerts as Array<{ code: string }>).map((item) => item.code);
    expect(codes).toContain('exchange_live_order_failures_spike');
    expect(codes).toContain('market_data_queue_lag_high');
    expect(codes).toContain('market_data_staleness');
    expect(codes).toContain('worker_heartbeat_missing');
  });
});
