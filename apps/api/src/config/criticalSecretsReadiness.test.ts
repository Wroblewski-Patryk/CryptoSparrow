import { afterEach, describe, expect, it } from 'vitest';
import {
  assertCriticalSecretsReadiness,
  evaluateCriticalSecretsReadiness,
} from './criticalSecretsReadiness';

const SECRET_ENV_KEYS = [
  'JWT_SECRET',
  'JWT_SECRET_PREVIOUS',
  'JWT_SECRET_PREVIOUS_UNTIL',
  'API_KEY_ENCRYPTION_KEYS',
  'API_KEY_ENCRYPTION',
  'API_KEY_ENCRYPTION_ACTIVE_VERSION',
] as const;

const originalEnv = Object.fromEntries(
  SECRET_ENV_KEYS.map((key) => [key, process.env[key]])
) as Record<(typeof SECRET_ENV_KEYS)[number], string | undefined>;

const resetEnv = () => {
  for (const key of SECRET_ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};

afterEach(() => {
  resetEnv();
});

const setBaseline = () => {
  process.env.JWT_SECRET = 'jwt-secret-primary';
  delete process.env.JWT_SECRET_PREVIOUS;
  delete process.env.JWT_SECRET_PREVIOUS_UNTIL;
  process.env.API_KEY_ENCRYPTION_KEYS = 'v1:key-one,v2:key-two';
  process.env.API_KEY_ENCRYPTION_ACTIVE_VERSION = 'v1';
  delete process.env.API_KEY_ENCRYPTION;
};

describe('criticalSecretsReadiness', () => {
  it('returns ready for valid baseline secrets', () => {
    setBaseline();
    const readiness = evaluateCriticalSecretsReadiness(Date.parse('2026-04-06T00:00:00.000Z'));
    expect(readiness.ready).toBe(true);
    expect(readiness.missing).toEqual([]);
    expect(readiness.issues).toEqual([]);
  });

  it('returns missing keys when JWT and encryption material are absent', () => {
    for (const key of SECRET_ENV_KEYS) {
      delete process.env[key];
    }
    const readiness = evaluateCriticalSecretsReadiness();
    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toEqual(['API_KEY_ENCRYPTION', 'API_KEY_ENCRYPTION_KEYS', 'JWT_SECRET']);
  });

  it('flags expired JWT previous-secret rotation windows', () => {
    setBaseline();
    process.env.JWT_SECRET_PREVIOUS = 'legacy-secret';
    process.env.JWT_SECRET_PREVIOUS_UNTIL = '2026-01-01T00:00:00.000Z';
    const readiness = evaluateCriticalSecretsReadiness(Date.parse('2026-04-06T00:00:00.000Z'));
    expect(readiness.ready).toBe(false);
    expect(readiness.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'JWT_SECRET_PREVIOUS_UNTIL',
          reason: expect.stringContaining('expired'),
        }),
      ])
    );
  });

  it('flags malformed encryption keyring entries and active-version mismatches', () => {
    setBaseline();
    process.env.API_KEY_ENCRYPTION_KEYS = 'broken-entry,v1:key-one';
    process.env.API_KEY_ENCRYPTION_ACTIVE_VERSION = 'v2';
    const readiness = evaluateCriticalSecretsReadiness();
    expect(readiness.ready).toBe(false);
    expect(readiness.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'API_KEY_ENCRYPTION_KEYS',
          reason: expect.stringContaining('malformed'),
        }),
        expect.objectContaining({
          key: 'API_KEY_ENCRYPTION_ACTIVE_VERSION',
          reason: expect.stringContaining('not found'),
        }),
      ])
    );
  });

  it('throws fail-safe startup error when readiness is invalid', () => {
    setBaseline();
    process.env.JWT_SECRET_PREVIOUS = 'legacy-secret';
    delete process.env.JWT_SECRET_PREVIOUS_UNTIL;
    expect(() => assertCriticalSecretsReadiness()).toThrowError(
      /Critical secret readiness check failed/
    );
  });
});
