import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../prisma/client';
import {
  createMarketGroup,
  createPayload,
  createStrategy,
  createWalletForContext,
  registerAndLogin,
  resetBotsE2eState,
} from './bots.e2e.shared';

describe('Bots wallet-first write contract', () => {
  beforeEach(resetBotsE2eState);

  it('ignores deprecated mode/paperStartBalance/apiKeyId fields on create and derives execution fields from wallet', async () => {
    const email = 'bots-wallet-contract-create@example.com';
    const agent = await registerAndLogin(email);
    const strategyId = await createStrategy(agent, 'Wallet Contract Create Strategy');
    const marketGroupId = await createMarketGroup(email, 'FUTURES');
    const paperWalletId = await createWalletForContext(email, {
      mode: 'PAPER',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      baseCurrency: 'USDT',
    });

    const createRes = await agent.post('/dashboard/bots').send({
      ...createPayload({
        strategyId,
        marketGroupId,
        walletId: paperWalletId,
      }),
      mode: 'LIVE',
      paperStartBalance: 123,
      apiKeyId: 'legacy-key-id',
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.walletId).toBe(paperWalletId);
    expect(createRes.body.mode).toBe('PAPER');
    expect(createRes.body.paperStartBalance).toBe(10_000);
    expect(createRes.body.apiKeyId).toBeNull();
  });

  it('ignores deprecated mode/paperStartBalance/apiKeyId fields on update payload', async () => {
    const email = 'bots-wallet-contract-update@example.com';
    const agent = await registerAndLogin(email);
    const strategyId = await createStrategy(agent, 'Wallet Contract Update Strategy');
    const marketGroupId = await createMarketGroup(email, 'FUTURES');
    const paperWalletId = await createWalletForContext(email, {
      mode: 'PAPER',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      baseCurrency: 'USDT',
    });

    const createRes = await agent.post('/dashboard/bots').send(
      createPayload({
        strategyId,
        marketGroupId,
        walletId: paperWalletId,
      })
    );
    expect(createRes.status).toBe(201);
    const botId = createRes.body.id as string;

    const updateRes = await agent.put(`/dashboard/bots/${botId}`).send({
      mode: 'LIVE',
      paperStartBalance: 222,
      apiKeyId: 'legacy-key-id',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.mode).toBe('PAPER');
    expect(updateRes.body.paperStartBalance).toBe(10_000);
    expect(updateRes.body.apiKeyId).toBeNull();
  });

  it('rejects wallet switch when existing bot market groups mismatch wallet market context', async () => {
    const email = 'bots-wallet-contract-mismatch@example.com';
    const agent = await registerAndLogin(email);
    const strategyId = await createStrategy(agent, 'Wallet Contract Mismatch Strategy');
    const marketGroupId = await createMarketGroup(email, 'FUTURES', 'BINANCE', 'USDT');

    const compatibleWalletId = await createWalletForContext(email, {
      mode: 'PAPER',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      baseCurrency: 'USDT',
    });
    const mismatchWalletId = await createWalletForContext(email, {
      mode: 'PAPER',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      baseCurrency: 'EUR',
    });

    const createRes = await agent.post('/dashboard/bots').send(
      createPayload({
        strategyId,
        marketGroupId,
        walletId: compatibleWalletId,
      })
    );
    expect(createRes.status).toBe(201);
    const botId = createRes.body.id as string;

    const updateRes = await agent.put(`/dashboard/bots/${botId}`).send({
      walletId: mismatchWalletId,
    });
    expect(updateRes.status).toBe(400);
    expect(updateRes.body.error.message).toBe(
      'wallet exchange/market/baseCurrency must match selected market group context'
    );

    const persisted = await prisma.bot.findUniqueOrThrow({
      where: { id: botId },
      select: { walletId: true },
    });
    expect(persisted.walletId).toBe(compatibleWalletId);
  });

  it('allows assigning one shared wallet to multiple bots with compatible context', async () => {
    const email = 'bots-wallet-contract-shared@example.com';
    const agent = await registerAndLogin(email);
    const strategyA = await createStrategy(agent, 'Wallet Contract Shared Strategy A');
    const strategyB = await createStrategy(agent, 'Wallet Contract Shared Strategy B');
    const marketGroupA = await createMarketGroup(email, 'FUTURES', 'BINANCE', 'USDT');
    const marketGroupB = await createMarketGroup(email, 'FUTURES', 'BINANCE', 'USDT');

    const sharedWalletId = await createWalletForContext(email, {
      mode: 'PAPER',
      exchange: 'BINANCE',
      marketType: 'FUTURES',
      baseCurrency: 'USDT',
    });

    const firstRes = await agent.post('/dashboard/bots').send(
      createPayload({
        strategyId: strategyA,
        marketGroupId: marketGroupA,
        walletId: sharedWalletId,
      })
    );
    expect(firstRes.status).toBe(201);

    const secondRes = await agent.post('/dashboard/bots').send(
      createPayload({
        strategyId: strategyB,
        marketGroupId: marketGroupB,
        walletId: sharedWalletId,
      })
    );
    expect(secondRes.status).toBe(201);

    expect(firstRes.body.walletId).toBe(sharedWalletId);
    expect(secondRes.body.walletId).toBe(sharedWalletId);
  });
});
