import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
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
    const setCookie = res.headers['set-cookie']?.[0] ?? '';
    expect(setCookie).toContain(`Max-Age=${Math.floor(REMEMBER_ME_TTL_MS / 1000)}`);
  });
});
