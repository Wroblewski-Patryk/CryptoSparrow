import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../index';
import { metricsStore } from '../observability/metrics';

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
};

const getMetrics = async () => {
  const res = await request(app).get('/metrics');
  expect(res.status).toBe(200);
  return res.body as MetricsPayload;
};

describe('metrics endpoint', () => {
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

    const after = await getMetrics();

    expect(after.exchange.orderAttempts).toBeGreaterThanOrEqual(before.exchange.orderAttempts + 1);
    expect(after.exchange.orderRetries).toBeGreaterThanOrEqual(before.exchange.orderRetries + 1);
    expect(after.exchange.orderFailures).toBeGreaterThanOrEqual(before.exchange.orderFailures + 1);
    expect(after.worker.queueLag.marketData).toBe(5);
    expect(after.worker.queueLag.backtest).toBe(2);
    expect(after.worker.queueLag.execution).toBe(1);
  });
});
