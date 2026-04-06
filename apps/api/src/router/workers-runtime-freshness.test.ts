import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../index';
import { prisma } from '../prisma/client';
import { metricsStore } from '../observability/metrics';

const originalWorkerHeartbeat = process.env.WORKER_LAST_HEARTBEAT_AT;
const originalMarketDataHeartbeat = process.env.WORKER_LAST_MARKET_DATA_AT;
const originalSessionThreshold = process.env.RUNTIME_FRESHNESS_MAX_SESSION_HEARTBEAT_MS;
const originalSignalThreshold = process.env.RUNTIME_FRESHNESS_MAX_SIGNAL_AGE_MS;

const restoreEnv = (key: string, value: string | undefined) => {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
};

beforeEach(async () => {
  await prisma.botRuntimeSession.updateMany({
    where: {
      status: 'RUNNING',
    },
    data: {
      status: 'CANCELED',
      finishedAt: new Date(),
      stopReason: 'test_cleanup',
    },
  });
  const nowIso = new Date().toISOString();
  process.env.WORKER_LAST_HEARTBEAT_AT = nowIso;
  process.env.WORKER_LAST_MARKET_DATA_AT = nowIso;
  process.env.RUNTIME_FRESHNESS_MAX_SESSION_HEARTBEAT_MS = '31536000000';
  process.env.RUNTIME_FRESHNESS_MAX_SIGNAL_AGE_MS = '300000';
  metricsStore.recordRuntimeSignalLag(0);
});

afterEach(() => {
  restoreEnv('WORKER_LAST_HEARTBEAT_AT', originalWorkerHeartbeat);
  restoreEnv('WORKER_LAST_MARKET_DATA_AT', originalMarketDataHeartbeat);
  restoreEnv('RUNTIME_FRESHNESS_MAX_SESSION_HEARTBEAT_MS', originalSessionThreshold);
  restoreEnv('RUNTIME_FRESHNESS_MAX_SIGNAL_AGE_MS', originalSignalThreshold);
});

const createAdminAgent = async () => {
  const email = `freshness-admin-${Date.now()}-${Math.random()}@example.com`;
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

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) throw new Error('Expected admin user to exist');

  const loginRes = await agent.post('/auth/login').send({
    email,
    password: 'Admin12#$',
  });
  expect(loginRes.status).toBe(200);

  return { agent, userId: user.id };
};

describe('workers runtime freshness endpoint', () => {
  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/workers/runtime-freshness');
    expect(res.status).toBe(401);
  });

  it('returns PASS when worker and market freshness are healthy', async () => {
    const { agent } = await createAdminAgent();
    const res = await agent.get('/workers/runtime-freshness');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PASS');
    expect(res.body.checks.workerHeartbeat.status).toBe('PASS');
    expect(res.body.checks.marketData.status).toBe('PASS');
  });

  it('returns FAIL when market data is stale', async () => {
    const { agent } = await createAdminAgent();
    process.env.WORKER_LAST_MARKET_DATA_AT = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const res = await agent.get('/workers/runtime-freshness');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('FAIL');
    expect(res.body.checks.marketData.status).toBe('FAIL');
  });

  it('returns FAIL when running sessions are stale', async () => {
    const { agent, userId } = await createAdminAgent();
    process.env.RUNTIME_FRESHNESS_MAX_SESSION_HEARTBEAT_MS = '60000';
    const bot = await prisma.bot.create({
      data: {
        userId,
        name: 'Freshness Bot',
      },
      select: { id: true },
    });
    await prisma.botRuntimeSession.create({
      data: {
        userId,
        botId: bot.id,
        mode: 'PAPER',
        status: 'RUNNING',
        lastHeartbeatAt: new Date(Date.now() - 5 * 60 * 1000),
      },
    });
    await prisma.signal.create({
      data: {
        userId,
        botId: bot.id,
        symbol: 'BTCUSDT',
        timeframe: '1m',
        direction: 'LONG',
        triggeredAt: new Date(),
      },
    });

    const res = await agent.get('/workers/runtime-freshness');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('FAIL');
    expect(res.body.checks.runtimeSessions.status).toBe('FAIL');
    expect(res.body.checks.runtimeSessions.staleSessionIds.length).toBeGreaterThan(0);
  });
});
