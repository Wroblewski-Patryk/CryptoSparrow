import { afterEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { signAuthToken, verifyAuthToken } from './auth.jwt';

const originalJwtSecret = process.env.JWT_SECRET;
const originalJwtSecretPrevious = process.env.JWT_SECRET_PREVIOUS;
const originalJwtSecretPreviousUntil = process.env.JWT_SECRET_PREVIOUS_UNTIL;

afterEach(() => {
  process.env.JWT_SECRET = originalJwtSecret;
  process.env.JWT_SECRET_PREVIOUS = originalJwtSecretPrevious;
  process.env.JWT_SECRET_PREVIOUS_UNTIL = originalJwtSecretPreviousUntil;
});

describe('auth.jwt', () => {
  it('signs and verifies token with the primary secret', () => {
    process.env.JWT_SECRET = 'primary-secret';
    process.env.JWT_SECRET_PREVIOUS = '';

    const token = signAuthToken(
      {
        userId: 'user-1',
        email: 'test@example.com',
        role: 'USER',
      },
      '1h'
    );

    const payload = verifyAuthToken(token);
    expect(payload.userId).toBe('user-1');
    expect(payload.email).toBe('test@example.com');
    expect(payload.role).toBe('USER');
  });

  it('accepts token signed with previous secret during rotation window', () => {
    process.env.JWT_SECRET = 'new-primary-secret';
    process.env.JWT_SECRET_PREVIOUS = 'old-secret';
    process.env.JWT_SECRET_PREVIOUS_UNTIL = '2999-01-01T00:00:00.000Z';

    const legacyToken = jwt.sign(
      {
        userId: 'user-legacy',
        email: 'legacy@example.com',
        role: 'USER',
      },
      'old-secret',
      {
        expiresIn: '1h',
        algorithm: 'HS256',
        issuer: 'cryptosparrow',
        audience: 'cryptosparrow-app',
      }
    );

    const payload = verifyAuthToken(legacyToken);
    expect(payload.userId).toBe('user-legacy');
  });

  it('rejects token signed with previous secret after rotation window expires', () => {
    process.env.JWT_SECRET = 'new-primary-secret';
    process.env.JWT_SECRET_PREVIOUS = 'old-secret';
    process.env.JWT_SECRET_PREVIOUS_UNTIL = '2000-01-01T00:00:00.000Z';

    const legacyToken = jwt.sign(
      {
        userId: 'user-expired',
        email: 'expired@example.com',
        role: 'USER',
      },
      'old-secret',
      {
        expiresIn: '1h',
        algorithm: 'HS256',
        issuer: 'cryptosparrow',
        audience: 'cryptosparrow-app',
      }
    );

    expect(() => verifyAuthToken(legacyToken)).toThrow('Invalid token');
  });
});
