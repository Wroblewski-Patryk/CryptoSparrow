import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../index';

type MetricsPayload = {
  http: {
    requestsTotal: number;
    status2xx: number;
    status4xx: number;
    status5xx: number;
    totalDurationMs: number;
    avgDurationMs: number;
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
});

