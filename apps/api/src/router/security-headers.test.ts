import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../index';

describe('security headers baseline', () => {
  it('returns hardened default headers on public health endpoint', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });
});

