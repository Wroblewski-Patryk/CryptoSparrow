import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../index';
import { clientUrl } from '../config/runtime';

const expectNoStoreHeaders = (res: request.Response) => {
  expect(res.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
  expect(res.headers['pragma']).toBe('no-cache');
  expect(res.headers['expires']).toBe('0');
  expect(res.headers['surrogate-control']).toBe('no-store');
  const varyValue = String(res.headers['vary'] ?? '')
    .split(',')
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);
  expect(varyValue).toContain('origin');
};

describe('cache-control headers for sensitive api namespaces', () => {
  it('applies no-store headers on /auth responses', async () => {
    const res = await request(app).get('/auth/me').set('Origin', clientUrl);

    expect(res.status).toBe(401);
    expectNoStoreHeaders(res);
  });

  it('applies no-store headers on /dashboard responses', async () => {
    const res = await request(app).get('/dashboard').set('Origin', clientUrl);

    expect(res.status).toBe(401);
    expectNoStoreHeaders(res);
  });

  it('applies no-store headers on /admin responses', async () => {
    const res = await request(app).get('/admin').set('Origin', clientUrl);

    expect(res.status).toBe(401);
    expectNoStoreHeaders(res);
  });
});
