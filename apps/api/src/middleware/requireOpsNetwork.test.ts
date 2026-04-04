import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { requireOpsNetwork } from './requireOpsNetwork';

const ORIGINAL_ALLOW_PRIVATE = process.env.OPS_ALLOW_PRIVATE_NETWORK;
const ORIGINAL_ALLOWED_IPS = process.env.OPS_ALLOWED_IPS;
const ORIGINAL_TRUSTED_PROXY_IPS = process.env.OPS_TRUSTED_PROXY_IPS;

const buildApp = () => {
  const app = express();
  app.set('trust proxy', true);

  app.use((req, _res, next) => {
    const simulatedRemoteIp = req.header('x-test-remote-ip');
    if (simulatedRemoteIp) {
      Object.defineProperty(req.socket, 'remoteAddress', {
        configurable: true,
        value: simulatedRemoteIp,
      });
    }
    next();
  });

  app.get('/ops-probe', requireOpsNetwork, (_req, res) => {
    res.status(200).json({ ok: true });
  });

  return app;
};

beforeEach(() => {
  process.env.OPS_ALLOW_PRIVATE_NETWORK = 'true';
  process.env.OPS_ALLOWED_IPS = '';
  process.env.OPS_TRUSTED_PROXY_IPS = '';
});

afterEach(() => {
  process.env.OPS_ALLOW_PRIVATE_NETWORK = ORIGINAL_ALLOW_PRIVATE;
  process.env.OPS_ALLOWED_IPS = ORIGINAL_ALLOWED_IPS;
  process.env.OPS_TRUSTED_PROXY_IPS = ORIGINAL_TRUSTED_PROXY_IPS;
});

describe('requireOpsNetwork', () => {
  it('allows access when request comes directly from private network', async () => {
    const app = buildApp();
    const res = await request(app).get('/ops-probe').set('x-test-remote-ip', '10.20.30.40');
    expect(res.status).toBe(200);
  });

  it('blocks spoofed x-forwarded-for when socket peer is not trusted proxy', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/ops-probe')
      .set('x-test-remote-ip', '8.8.8.8')
      .set('x-forwarded-for', '10.0.0.7');
    expect(res.status).toBe(403);
  });

  it('uses forwarded client IP only when socket peer is trusted proxy', async () => {
    process.env.OPS_ALLOWED_IPS = '203.0.113.10';
    const app = buildApp();
    const res = await request(app)
      .get('/ops-probe')
      .set('x-test-remote-ip', '10.0.0.2')
      .set('x-forwarded-for', '203.0.113.10');
    expect(res.status).toBe(200);
  });

  it('respects private-network toggle and denies private source when disabled', async () => {
    process.env.OPS_ALLOW_PRIVATE_NETWORK = 'false';
    const app = buildApp();
    const res = await request(app).get('/ops-probe').set('x-test-remote-ip', '192.168.1.10');
    expect(res.status).toBe(403);
  });
});

