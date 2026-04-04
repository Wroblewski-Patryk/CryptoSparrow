import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../index';
import { prisma } from '../prisma/client';
import { signAuthToken } from '../modules/auth/auth.jwt';
import { clientUrl } from '../config/runtime';

const originalCookieSameSite = process.env.COOKIE_SAME_SITE;

const createSessionCookie = async () => {
  const user = await prisma.user.create({
    data: {
      email: `origin-guard-${Date.now()}@example.com`,
      password: 'hashed-password',
    },
  });

  const token = signAuthToken(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionVersion: user.sessionVersion,
    },
    '1h'
  );
  return `token=${token}`;
};

afterEach(async () => {
  process.env.COOKIE_SAME_SITE = originalCookieSameSite;
  await prisma.user.deleteMany({
    where: {
      email: {
        startsWith: 'origin-guard-',
      },
    },
  });
});

describe('requireTrustedOrigin middleware', () => {
  it('allows state-changing request with trusted origin', async () => {
    const sessionCookie = await createSessionCookie();
    const res = await request(app)
      .post('/auth/logout')
      .set('Cookie', [sessionCookie])
      .set('Origin', clientUrl)
      .send({});

    expect(res.status).toBe(200);
  });

  it('blocks state-changing request with untrusted referer/origin', async () => {
    const sessionCookie = await createSessionCookie();
    const res = await request(app)
      .post('/auth/logout')
      .set('Cookie', [sessionCookie])
      .set('Referer', 'https://evil.example.com/path')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('Untrusted origin');
  });

  it('allows missing origin for cookie sessions when sameSite is not none', async () => {
    process.env.COOKIE_SAME_SITE = 'lax';
    const sessionCookie = await createSessionCookie();
    const res = await request(app).post('/auth/logout').set('Cookie', [sessionCookie]).send({});

    expect(res.status).toBe(200);
  });

  it('requires origin when sameSite is none', async () => {
    process.env.COOKIE_SAME_SITE = 'none';
    const sessionCookie = await createSessionCookie();
    const res = await request(app).post('/auth/logout').set('Cookie', [sessionCookie]).send({});

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('Origin header required for state-changing requests');
  });
});
