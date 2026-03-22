import { describe, expect, it } from 'vitest';
import { Request } from 'express';
import { __rateLimitInternals } from './rateLimit';

const makeRequest = (overrides: Partial<Request> = {}) =>
  ({
    method: 'GET',
    baseUrl: '/dashboard',
    path: '/orders',
    headers: {},
    query: {},
    params: {},
    body: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  }) as Request;

describe('rate limit identity resolution', () => {
  it('uses auth email when keyScope=auth', () => {
    const req = makeRequest({
      body: { email: 'User@Test.com' },
    });
    const subject = __rateLimitInternals.resolveRateLimitSubject(req, 'auth');
    expect(subject).toBe('auth:user@test.com');
  });

  it('uses user id for authenticated dashboard requests', () => {
    const req = makeRequest({
      user: { id: 'user-123', email: 'u@test.com', role: 'USER' },
    });
    const subject = __rateLimitInternals.resolveRateLimitSubject(req, 'user');
    expect(subject).toBe('user:user-123');
  });

  it('uses exchange+apiKey fingerprint scope for key tests', () => {
    const req = makeRequest({
      user: { id: 'user-999', email: 'u@test.com', role: 'USER' },
      body: { exchange: 'BINANCE', apiKey: 'abc123-secret-key' },
    });
    const subject = __rateLimitInternals.resolveRateLimitSubject(req, 'user_exchange');
    expect(subject).toContain('user:user-999:exchange:binance:key:hash:');
    expect(subject.endsWith('hash:abc123-secret-key')).toBe(false);
  });
});
