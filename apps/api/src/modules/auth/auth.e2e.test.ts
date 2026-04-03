import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { app } from '../../index';
import { prisma } from '../../prisma/client';
import { REMEMBER_ME_TTL_MS, SESSION_TTL_MS } from './auth.session';

describe('POST /auth/register', () => {
  beforeEach(async () => {
    await prisma.log.deleteMany();
    await prisma.backtestReport.deleteMany();
    await prisma.backtestTrade.deleteMany();
    await prisma.backtestRun.deleteMany();
    await prisma.trade.deleteMany();
    await prisma.order.deleteMany();
    await prisma.position.deleteMany();
    await prisma.signal.deleteMany();
    await prisma.botStrategy.deleteMany();
    await prisma.botSubagentConfig.deleteMany();
    await prisma.botAssistantConfig.deleteMany();
    await prisma.marketGroupStrategyLink.deleteMany();
    await prisma.botMarketGroup.deleteMany();
    await prisma.botRuntimeEvent.deleteMany();
    await prisma.botRuntimeSymbolStat.deleteMany();
    await prisma.botRuntimeSession.deleteMany();
    await prisma.bot.deleteMany();
    await prisma.symbolGroup.deleteMany();
    await prisma.marketUniverse.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.user.deleteMany();
  });

  it('should register a user successfully', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: 'test1234',
      });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user.password).toBeUndefined();
  });

  it('should reject weak password', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'fail@example.com',
        password: '123',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
    expect(res.body.error.details[0].field).toBe('password');
  });

  it('should reject duplicate email', async () => {
    await prisma.user.create({
      data: {
        email: 'dupe@example.com',
        password: 'hashed', // może być byle co
      },
    });

    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'dupe@example.com',
        password: 'test1234',
      });

    expect(res.status).toBe(500); // because service throws duplicate error
    expect(res.body.error.message).toBe('Registration failed');
  });

  it('sets short-lived cookie for login without remember me', async () => {
    await request(app).post('/auth/register').send({
      email: 'session-short@example.com',
      password: 'test1234',
    });

    const res = await request(app).post('/auth/login').send({
      email: 'session-short@example.com',
      password: 'test1234',
      remember: false,
    });

    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie']?.[0] ?? '';
    expect(setCookie).toContain(`Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`);
  });

  it('sets remember-me cookie for login with remember flag', async () => {
    await request(app).post('/auth/register').send({
      email: 'session-remember@example.com',
      password: 'test1234',
    });

    const res = await request(app).post('/auth/login').send({
      email: 'session-remember@example.com',
      password: 'test1234',
      remember: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.user.password).toBeUndefined();
    const setCookie = res.headers['set-cookie']?.[0] ?? '';
    expect(setCookie).toContain(`Max-Age=${Math.floor(REMEMBER_ME_TTL_MS / 1000)}`);
  });

  it('clears session and returns 401 on /auth/me when user was deleted', async () => {
    const agent = request.agent(app);
    const email = 'deleted-session@example.com';
    const password = 'test1234';

    const registerRes = await agent.post('/auth/register').send({ email, password });
    expect(registerRes.status).toBe(201);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.user.delete({ where: { id: user.id } });

    const meRes = await agent.get('/auth/me');
    expect(meRes.status).toBe(401);
    expect(meRes.body.error.message).toBe('Session expired. Please sign in again.');
    const clearedCookie = meRes.headers['set-cookie']?.[0] ?? '';
    expect(clearedCookie).toContain('token=');
  });

  it('uses newest valid token on /auth/me when duplicate token cookies are sent', async () => {
    const originalJwtSecret = process.env.JWT_SECRET;
    const originalJwtSecretPrevious = process.env.JWT_SECRET_PREVIOUS;
    const originalJwtSecretPreviousUntil = process.env.JWT_SECRET_PREVIOUS_UNTIL;

    process.env.JWT_SECRET = 'auth-me-token-precedence-secret';
    process.env.JWT_SECRET_PREVIOUS = '';
    process.env.JWT_SECRET_PREVIOUS_UNTIL = '';
    try {
      const olderUser = await prisma.user.create({
        data: {
          email: `me-older-${Date.now()}@example.com`,
          password: 'hashed-password',
        },
      });
      const newerUser = await prisma.user.create({
        data: {
          email: `me-newer-${Date.now()}@example.com`,
          password: 'hashed-password',
        },
      });

      const nowSec = Math.floor(Date.now() / 1000);
      const olderToken = jwt.sign(
        {
          userId: olderUser.id,
          email: olderUser.email,
          role: 'USER',
          iat: nowSec - 120,
          exp: nowSec + 3600,
        },
        'auth-me-token-precedence-secret',
        {
          algorithm: 'HS256',
          issuer: 'cryptosparrow',
          audience: 'cryptosparrow-app',
        }
      );
      const newerToken = jwt.sign(
        {
          userId: newerUser.id,
          email: newerUser.email,
          role: 'USER',
          iat: nowSec - 60,
          exp: nowSec + 3600,
        },
        'auth-me-token-precedence-secret',
        {
          algorithm: 'HS256',
          issuer: 'cryptosparrow',
          audience: 'cryptosparrow-app',
        }
      );

      const meRes = await request(app)
        .get('/auth/me')
        .set('Cookie', [`token=${olderToken}`, `token=${newerToken}`]);

      expect(meRes.status).toBe(200);
      expect(meRes.body.id).toBe(newerUser.id);
      expect(meRes.body.email).toBe(newerUser.email);
    } finally {
      process.env.JWT_SECRET = originalJwtSecret;
      process.env.JWT_SECRET_PREVIOUS = originalJwtSecretPrevious;
      process.env.JWT_SECRET_PREVIOUS_UNTIL = originalJwtSecretPreviousUntil;
    }
  });
});


