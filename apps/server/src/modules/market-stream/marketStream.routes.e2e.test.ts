import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../index';
import { prisma } from '../../prisma/client';

describe('Market stream SSE route contract', () => {
  const registerAndLogin = async () => {
    const email = `stream-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
    const password = 'test1234';

    await request(app).post('/auth/register').send({ email, password });
    const loginRes = await request(app).post('/auth/login').send({ email, password });
    return loginRes.headers['set-cookie'] ?? [];
  };

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
    await prisma.strategy.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
  });

  it('rejects unauthenticated stream connection', async () => {
    const res = await request(app).get('/dashboard/market-stream/events');
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Missing token');
  });

  it('rejects stream query when symbol count exceeds contract limit', async () => {
    const cookie = await registerAndLogin();
    const symbols = Array.from({ length: 21 }, (_, index) => `SYM${index}USDT`).join(',');

    const res = await request(app)
      .get(`/dashboard/market-stream/events?symbols=${symbols}&interval=1m`)
      .set('Cookie', cookie);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
    expect(res.body.error.details?.[0]).toEqual({
      field: 'symbols',
      message: 'Maximum 20 symbols allowed',
    });
  });
});
