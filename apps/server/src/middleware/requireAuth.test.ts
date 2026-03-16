import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../index';

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

    const token = jwt.sign(
      {
        userId: 'user-rotation',
        email: 'rotation@example.com',
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
    expect(res.body.user.id).toBe('user-rotation');
    expect(res.body.user.email).toBe('rotation@example.com');
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
});
