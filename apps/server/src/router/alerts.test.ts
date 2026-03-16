import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../index';
import { metricsStore } from '../observability/metrics';

const originalMarketDataAt = process.env.WORKER_LAST_MARKET_DATA_AT;
const originalHeartbeatAt = process.env.WORKER_LAST_HEARTBEAT_AT;

afterEach(() => {
  process.env.WORKER_LAST_MARKET_DATA_AT = originalMarketDataAt;
  process.env.WORKER_LAST_HEARTBEAT_AT = originalHeartbeatAt;
  metricsStore.setWorkerQueueLag('marketData', 0);
  metricsStore.setWorkerQueueLag('backtest', 0);
  metricsStore.setWorkerQueueLag('execution', 0);
});

describe('alerts endpoint', () => {
  it('returns alerts for failure spike, staleness, and missing heartbeat', async () => {
    metricsStore.recordExchangeOrderFailure();
    metricsStore.recordExchangeOrderFailure();
    metricsStore.recordExchangeOrderFailure();
    metricsStore.setWorkerQueueLag('marketData', 150);

    process.env.WORKER_LAST_MARKET_DATA_AT = '2000-01-01T00:00:00.000Z';
    process.env.WORKER_LAST_HEARTBEAT_AT = '2000-01-01T00:00:00.000Z';

    const res = await request(app).get('/alerts');
    expect(res.status).toBe(200);

    const codes = (res.body.alerts as Array<{ code: string }>).map((item) => item.code);
    expect(codes).toContain('exchange_live_order_failures_spike');
    expect(codes).toContain('market_data_queue_lag_high');
    expect(codes).toContain('market_data_staleness');
    expect(codes).toContain('worker_heartbeat_missing');
  });
});

