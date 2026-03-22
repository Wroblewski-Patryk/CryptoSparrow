import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../index';
import { prisma } from '../prisma/client';
import * as authJwt from '../modules/auth/auth.jwt';

const originalJwtSecret = process.env.JWT_SECRET;
const originalJwtSecretPrevious = process.env.JWT_SECRET_PREVIOUS;
const originalJwtSecretPreviousUntil = process.env.JWT_SECRET_PREVIOUS_UNTIL;

afterEach(() => {
  process.env.JWT_SECRET = originalJwtSecret;
  process.env.JWT_SECRET_PREVIOUS = originalJwtSecretPrevious;
  process.env.JWT_SECRET_PREVIOUS_UNTIL = originalJwtSecretPreviousUntil;
});

describe('requireAuth middleware', () => {
  it('accepts dashboard access for token signed with previous secret during rotation', async () => {
    process.env.JWT_SECRET = 'new-secret';
    process.env.JWT_SECRET_PREVIOUS = 'old-secret';
    process.env.JWT_SECRET_PREVIOUS_UNTIL = '2999-01-01T00:00:00.000Z';
    const email = `rotation-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email,
        password: 'hashed-password',
      },
    });

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
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

    const res = await request(app).get('/dashboard').set('Cookie', [`token=${token}`]);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
    expect(res.body.user.email).toBe(user.email);
  });

  it('rejects token when issuer/audience claims are invalid', async () => {
    process.env.JWT_SECRET = 'primary-secret';
    process.env.JWT_SECRET_PREVIOUS = '';

    const token = jwt.sign(
      {
        userId: 'user-invalid',
        email: 'invalid@example.com',
        role: 'USER',
      },
      'primary-secret',
      {
        expiresIn: '1h',
        algorithm: 'HS256',
        issuer: 'wrong-issuer',
        audience: 'wrong-audience',
      }
    );

    const res = await request(app).get('/dashboard').set('Cookie', [`token=${token}`]);
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid token');
  });

  it('returns 503 when auth user lookup is temporarily unavailable', async () => {
    const verifySpy = vi.spyOn(authJwt, 'verifyAuthToken').mockReturnValue({
      userId: 'db-down-user',
      email: 'db-down@example.com',
      role: 'USER',
      iat: 0,
      exp: 0,
      aud: 'cryptosparrow-app',
      iss: 'cryptosparrow',
    });
    const findUniqueSpy = vi.spyOn(prisma.user, 'findUnique').mockRejectedValueOnce(new Error('db unavailable'));
    const res = await request(app).get('/dashboard').set('Cookie', ['token=test-token']);
    expect(res.status).toBe(503);
    expect(res.body.error.message).toBe('Auth service temporarily unavailable');
    findUniqueSpy.mockRestore();
    verifySpy.mockRestore();
  });
});
