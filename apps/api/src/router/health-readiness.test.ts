import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../index';

const originalJwtSecret = process.env.JWT_SECRET;
const originalJwtSecretPrevious = process.env.JWT_SECRET_PREVIOUS;
const originalJwtSecretPreviousUntil = process.env.JWT_SECRET_PREVIOUS_UNTIL;
const originalApiKeyEncryptionKeys = process.env.API_KEY_ENCRYPTION_KEYS;
const originalApiKeyEncryption = process.env.API_KEY_ENCRYPTION;
const originalApiKeyEncryptionActiveVersion = process.env.API_KEY_ENCRYPTION_ACTIVE_VERSION;

afterEach(() => {
  const restoreEnv = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };
  restoreEnv('JWT_SECRET', originalJwtSecret);
  restoreEnv('JWT_SECRET_PREVIOUS', originalJwtSecretPrevious);
  restoreEnv('JWT_SECRET_PREVIOUS_UNTIL', originalJwtSecretPreviousUntil);
  restoreEnv('API_KEY_ENCRYPTION_KEYS', originalApiKeyEncryptionKeys);
  restoreEnv('API_KEY_ENCRYPTION', originalApiKeyEncryption);
  restoreEnv('API_KEY_ENCRYPTION_ACTIVE_VERSION', originalApiKeyEncryptionActiveVersion);
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
    process.env.API_KEY_ENCRYPTION_KEYS = 'v1:ready-key';
    process.env.API_KEY_ENCRYPTION_ACTIVE_VERSION = 'v1';
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.service).toBe('api');
  });

  it('returns not_ready with secret rotation issues', async () => {
    process.env.JWT_SECRET = 'ready-test-secret';
    process.env.JWT_SECRET_PREVIOUS = 'old-secret';
    process.env.JWT_SECRET_PREVIOUS_UNTIL = '2026-01-01T00:00:00.000Z';
    process.env.API_KEY_ENCRYPTION_KEYS = 'v1:ready-key';
    process.env.API_KEY_ENCRYPTION_ACTIVE_VERSION = 'v1';

    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('not_ready');
    expect(res.body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'JWT_SECRET_PREVIOUS_UNTIL',
        }),
      ])
    );
  });
});
