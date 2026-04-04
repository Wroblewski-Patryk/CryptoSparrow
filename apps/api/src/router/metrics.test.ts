import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../index';
import { metricsStore } from '../observability/metrics';
import { prisma } from '../prisma/client';

type MetricsPayload = {
  http: {
    requestsTotal: number;
    status2xx: number;
    status4xx: number;
    status5xx: number;
    totalDurationMs: number;
    avgDurationMs: number;
  };
  exchange: {
    orderAttempts: number;
    orderRetries: number;
    orderFailures: number;
  };
  worker: {
    queueLag: {
      marketData: number;
      backtest: number;
      execution: number;
    };
  };
  runtime: {
    groupEvaluation: {
      total: number;
      totalDurationMs: number;
      avgDurationMs: number;
    };
    mergeOutcomes: {
      long: number;
      short: number;
      exit: number;
      noTrade: number;
    };
    signalLag: {
      total: number;
      lastMs: number;
      maxMs: number;
      totalLagMs: number;
      avgLagMs: number;
    };
    restarts: {
      total: number;
      noEvent: number;
      noHeartbeat: number;
    };
    reconciliation: {
      total: number;
      pending: number;
      totalDelayMs: number;
      avgDelayMs: number;
      maxDelayMs: number;
    };
    executionErrors: Record<string, number>;
  };
  assistant: {
    subagentTimeouts: number;
  };
};

const getMetrics = async () => {
  const adminAgent = await createAdminAgent();
  const res = await adminAgent.get('/metrics');
  expect(res.status).toBe(200);
  return res.body as MetricsPayload;
};

const createAdminAgent = async () => {
  const email = `metrics-admin-${Date.now()}-${Math.random()}@example.com`;
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

const createUserAgent = async () => {
  const email = `metrics-user-${Date.now()}-${Math.random()}@example.com`;
  const agent = request.agent(app);
  const registerRes = await agent.post('/auth/register').send({
    email,
    password: 'Admin12#$',
  });
  expect(registerRes.status).toBe(201);
  const loginRes = await agent.post('/auth/login').send({
    email,
    password: 'Admin12#$',
  });
  expect(loginRes.status).toBe(200);
  return agent;
};

describe('metrics endpoint', () => {
  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(401);
  });

  it('rejects non-admin access', async () => {
    const userAgent = await createUserAgent();
    const res = await userAgent.get('/metrics');
    expect(res.status).toBe(403);
  });

  it('rejects requests from disallowed network', async () => {
    const adminAgent = await createAdminAgent();
    const res = await adminAgent.get('/metrics').set('x-forwarded-for', '8.8.8.8');
    expect(res.status).toBe(403);
  });

  it('exposes cumulative http request counters and duration aggregates', async () => {
    const before = await getMetrics();

    await request(app).get('/');
    await request(app).get('/does-not-exist');

    const after = await getMetrics();

    expect(after.http.requestsTotal).toBeGreaterThanOrEqual(before.http.requestsTotal + 3);
    expect(after.http.status2xx).toBeGreaterThanOrEqual(before.http.status2xx + 2);
    expect(after.http.status4xx).toBeGreaterThanOrEqual(before.http.status4xx + 1);
    expect(after.http.totalDurationMs).toBeGreaterThanOrEqual(before.http.totalDurationMs);
    expect(after.http.avgDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('exposes exchange failure/retry counters and worker queue lag gauges', async () => {
    const before = await getMetrics();

    metricsStore.recordExchangeOrderAttempt();
    metricsStore.recordExchangeOrderRetry();
    metricsStore.recordExchangeOrderFailure();
    metricsStore.setWorkerQueueLag('marketData', 5);
    metricsStore.setWorkerQueueLag('backtest', 2);
    metricsStore.setWorkerQueueLag('execution', 1);
    metricsStore.recordRuntimeGroupEvaluation(12);
    metricsStore.recordRuntimeMergeOutcome('NO_TRADE');
    metricsStore.recordRuntimeSignalLag(42);
    metricsStore.recordRuntimeRestart('runtime_stall_no_event');
    metricsStore.recordRuntimeReconciliationDelay(25, true);
    metricsStore.recordRuntimeExecutionError('runtime_watchdog_sync_failure');
    metricsStore.recordAssistantSubagentTimeout();

    const after = await getMetrics();

    expect(after.exchange.orderAttempts).toBeGreaterThanOrEqual(before.exchange.orderAttempts + 1);
    expect(after.exchange.orderRetries).toBeGreaterThanOrEqual(before.exchange.orderRetries + 1);
    expect(after.exchange.orderFailures).toBeGreaterThanOrEqual(before.exchange.orderFailures + 1);
    expect(after.worker.queueLag.marketData).toBe(5);
    expect(after.worker.queueLag.backtest).toBe(2);
    expect(after.worker.queueLag.execution).toBe(1);
    expect(after.runtime.groupEvaluation.total).toBeGreaterThanOrEqual(
      before.runtime.groupEvaluation.total + 1
    );
    expect(after.runtime.mergeOutcomes.noTrade).toBeGreaterThanOrEqual(
      before.runtime.mergeOutcomes.noTrade + 1
    );
    expect(after.runtime.signalLag.total).toBeGreaterThanOrEqual(before.runtime.signalLag.total + 1);
    expect(after.runtime.signalLag.maxMs).toBeGreaterThanOrEqual(before.runtime.signalLag.maxMs);
    expect(after.runtime.restarts.total).toBeGreaterThanOrEqual(before.runtime.restarts.total + 1);
    expect(after.runtime.restarts.noEvent).toBeGreaterThanOrEqual(before.runtime.restarts.noEvent + 1);
    expect(after.runtime.reconciliation.total).toBeGreaterThanOrEqual(
      before.runtime.reconciliation.total + 1
    );
    expect(after.runtime.reconciliation.pending).toBeGreaterThanOrEqual(
      before.runtime.reconciliation.pending + 1
    );
    expect(after.runtime.executionErrors.runtime_watchdog_sync_failure ?? 0).toBeGreaterThanOrEqual(
      (before.runtime.executionErrors.runtime_watchdog_sync_failure ?? 0) + 1
    );
    expect(after.assistant.subagentTimeouts).toBeGreaterThanOrEqual(
      before.assistant.subagentTimeouts + 1
    );
  });
});
