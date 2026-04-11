import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../index';
import { prisma } from '../../prisma/client';

const registerAndLogin = async (email: string) => {
  const agent = request.agent(app);
  const res = await agent.post('/auth/register').send({
    email,
    password: 'test1234',
  });
  expect(res.status).toBe(201);
  return agent;
};

describe('Wallets balance preview contract', () => {
  beforeEach(async () => {
    delete process.env.WALLET_PREVIEW_TEST_ACCOUNT_BALANCE;
    delete process.env.WALLET_PREVIEW_TEST_FREE_BALANCE;
    await prisma.botSubagentConfig.deleteMany();
    await prisma.botAssistantConfig.deleteMany();
    await prisma.marketGroupStrategyLink.deleteMany();
    await prisma.botMarketGroup.deleteMany();
    await prisma.botRuntimeSymbolStat.deleteMany();
    await prisma.botRuntimeEvent.deleteMany();
    await prisma.botRuntimeSession.deleteMany();
    await prisma.botStrategy.deleteMany();
    await prisma.bot.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.symbolGroup.deleteMany();
    await prisma.marketUniverse.deleteMany();
    await prisma.position.deleteMany();
    await prisma.order.deleteMany();
    await prisma.trade.deleteMany();
    await prisma.signal.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.log.deleteMany();
    await prisma.user.deleteMany();
  });

  it('rejects unauthenticated balance preview access', async () => {
    const res = await request(app).post('/dashboard/wallets/preview-balance').send({
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      baseCurrency: 'USDT',
      apiKeyId: 'missing',
    });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Missing token');
  });

  it('returns wallet balance preview for owned API key with allocation applied', async () => {
    const agent = await registerAndLogin('wallet-preview-owner@example.com');

    const apiKeyRes = await agent.post('/dashboard/profile/apiKeys').send({
      label: 'Preview key',
      exchange: 'BINANCE',
      apiKey: 'PREVIEW_KEY_123',
      apiSecret: 'PREVIEW_SECRET_123',
      syncExternalPositions: true,
      manageExternalPositions: true,
    });
    expect(apiKeyRes.status).toBe(201);

    process.env.WALLET_PREVIEW_TEST_ACCOUNT_BALANCE = '250';
    process.env.WALLET_PREVIEW_TEST_FREE_BALANCE = '210';

    const previewRes = await agent.post('/dashboard/wallets/preview-balance').send({
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      baseCurrency: 'USDT',
      apiKeyId: apiKeyRes.body.id,
      liveAllocationMode: 'PERCENT',
      liveAllocationValue: 40,
    });

    expect(previewRes.status).toBe(200);
    expect(previewRes.body).toMatchObject({
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      baseCurrency: 'USDT',
      accountBalance: 250,
      freeBalance: 210,
      referenceBalance: 100,
      allocationApplied: {
        mode: 'PERCENT',
        value: 40,
      },
      source: 'BINANCE',
    });
    expect(typeof previewRes.body.fetchedAt).toBe('string');
  });

  it('returns 404 when selected API key does not belong to current user', async () => {
    const owner = await registerAndLogin('wallet-preview-owner-2@example.com');
    const other = await registerAndLogin('wallet-preview-other@example.com');

    const apiKeyRes = await owner.post('/dashboard/profile/apiKeys').send({
      label: 'Owner key',
      exchange: 'BINANCE',
      apiKey: 'OWNER_KEY_123',
      apiSecret: 'OWNER_SECRET_123',
      syncExternalPositions: true,
      manageExternalPositions: true,
    });
    expect(apiKeyRes.status).toBe(201);

    const previewRes = await other.post('/dashboard/wallets/preview-balance').send({
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      baseCurrency: 'USDT',
      apiKeyId: apiKeyRes.body.id,
    });

    expect(previewRes.status).toBe(404);
    expect(previewRes.body.error.message).toBe('api key not found for selected exchange context');
  });

  it('fails closed for placeholder exchanges', async () => {
    const agent = await registerAndLogin('wallet-preview-placeholder@example.com');

    const previewRes = await agent.post('/dashboard/wallets/preview-balance').send({
      exchange: 'OKX',
      marketType: 'FUTURES',
      baseCurrency: 'USDT',
      apiKeyId: 'any-key',
    });

    expect(previewRes.status).toBe(501);
    expect(previewRes.body.error.details).toEqual({
      code: 'EXCHANGE_NOT_IMPLEMENTED',
      exchange: 'OKX',
      capability: 'LIVE_EXECUTION',
    });
  });
});
