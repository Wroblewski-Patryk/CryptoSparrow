import request from 'supertest';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../index';
import { prisma } from '../../prisma/client';
import { resetCoinIconResolverStateForTests } from './icons.service';

const registerAndLogin = async (email: string) => {
  const agent = request.agent(app);
  const res = await agent.post('/auth/register').send({
    email,
    password: 'test1234',
  });
  expect(res.status).toBe(201);
  return agent;
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('Icons lookup module contract', () => {
  const fetchMock = vi.fn();

  beforeEach(async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    resetCoinIconResolverStateForTests();

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
    await prisma.botRuntimeSymbolStat.deleteMany();
    await prisma.botRuntimeEvent.deleteMany();
    await prisma.botRuntimeSession.deleteMany();
    await prisma.bot.deleteMany();
    await prisma.symbolGroup.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.marketUniverse.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/dashboard/icons/lookup').query({
      symbols: 'BTCUSDT',
    });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Missing token');
  });

  it('returns coingecko icon metadata and serves subsequent request from cache', async () => {
    const agent = await registerAndLogin('icons-cache@example.com');

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'bitcoin',
        image: {
          large: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
        },
      })
    );

    const first = await agent.get('/dashboard/icons/lookup').query({
      symbols: 'BTCUSDT',
    });
    expect(first.status).toBe(200);
    expect(first.body.total).toBe(1);
    expect(first.body.items[0]).toMatchObject({
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      source: 'coingecko',
      placeholder: false,
      coinGeckoId: 'bitcoin',
      cacheHit: false,
      iconUrl: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
    });

    const second = await agent.get('/dashboard/icons/lookup').query({
      symbols: 'BTCUSDT',
    });
    expect(second.status).toBe(200);
    expect(second.body.items[0].cacheHit).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('resolves collisions deterministically using market-cap rank', async () => {
    const agent = await registerAndLogin('icons-collision@example.com');

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        coins: [
          {
            id: 'cat-token-low',
            symbol: 'cat',
            market_cap_rank: 420,
            large: 'https://img.example.com/cat-token-low.png',
          },
          {
            id: 'cat-token-top',
            symbol: 'cat',
            market_cap_rank: 5,
            large: 'https://img.example.com/cat-token-top.png',
          },
        ],
      })
    );

    const res = await agent.get('/dashboard/icons/lookup').query({
      symbols: 'CATUSDT',
    });

    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({
      symbol: 'CATUSDT',
      baseAsset: 'CAT',
      source: 'coingecko',
      coinGeckoId: 'cat-token-top',
      iconUrl: 'https://img.example.com/cat-token-top.png',
    });
  });

  it('falls back to curated icon map when coingecko is unavailable', async () => {
    const agent = await registerAndLogin('icons-curated@example.com');

    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));

    const res = await agent.get('/dashboard/icons/lookup').query({
      symbols: 'SOLUSDT',
    });

    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({
      symbol: 'SOLUSDT',
      baseAsset: 'SOL',
      source: 'curated',
      placeholder: false,
      coinGeckoId: null,
    });
    expect(String(res.body.items[0].iconUrl)).toContain('sol.png');
  });

  it('falls back to deterministic placeholder for unknown assets', async () => {
    const agent = await registerAndLogin('icons-placeholder@example.com');

    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));

    const res = await agent.get('/dashboard/icons/lookup').query({
      symbols: 'UNKNOWNXYZ',
    });

    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({
      symbol: 'UNKNOWNXYZ',
      baseAsset: 'UNKNOWNXYZ',
      source: 'placeholder',
      placeholder: true,
      coinGeckoId: null,
    });
    expect(String(res.body.items[0].iconUrl)).toContain('data:image/svg+xml');
  });
});

