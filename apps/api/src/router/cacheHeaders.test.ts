import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../index';

const expectNoStoreHeaders = (res: request.Response) => {
  expect(res.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
  expect(res.headers['pragma']).toBe('no-cache');
  expect(res.headers['expires']).toBe('0');
  expect(res.headers['surrogate-control']).toBe('no-store');
};

describe('cache-control headers for sensitive api namespaces', () => {
  it('applies no-store headers on /auth responses', async () => {
    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
    expectNoStoreHeaders(res);
  });

  it('applies no-store headers on /dashboard responses', async () => {
    const res = await request(app).get('/dashboard');

    expect(res.status).toBe(401);
    expectNoStoreHeaders(res);
  });

  it('applies no-store headers on /admin responses', async () => {
    const res = await request(app).get('/admin');

    expect(res.status).toBe(401);
    expectNoStoreHeaders(res);
  });
});

