import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../index';

const originalJwtSecret = process.env.JWT_SECRET;

afterEach(() => {
  process.env.JWT_SECRET = originalJwtSecret;
});

describe('health and readiness endpoints', () => {
  it('returns API health status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('api');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('returns not_ready when required runtime configuration is missing', async () => {
    process.env.JWT_SECRET = '';
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('not_ready');
    expect(res.body.missing).toContain('JWT_SECRET');
  });

  it('returns ready when runtime requirements are satisfied', async () => {
    process.env.JWT_SECRET = 'ready-test-secret';
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.service).toBe('api');
  });
});

