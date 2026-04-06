import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../../index';
import { prisma } from '../../../prisma/client';
import { SubscriptionEntitlementsSchema } from '../../subscriptions/subscriptionEntitlements.service';
import { ensureSubscriptionCatalog } from '../../subscriptions/subscriptions.service';

const createAdminAgent = async () => {
  const email = `admin-subscriptions-${Date.now()}-${Math.random()}@example.com`;
  const agent = request.agent(app);
  const password = 'Admin12#$';

  const registerRes = await agent.post('/auth/register').send({
    email,
    password,
  });
  expect(registerRes.status).toBe(201);

  await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN' },
  });

  const loginRes = await agent.post('/auth/login').send({
    email,
    password,
  });
  expect(loginRes.status).toBe(200);

  return agent;
};

const createUserAgent = async () => {
  const email = `user-subscriptions-${Date.now()}-${Math.random()}@example.com`;
  const agent = request.agent(app);
  const password = 'User12#$';

  const registerRes = await agent.post('/auth/register').send({
    email,
    password,
  });
  expect(registerRes.status).toBe(201);

  const loginRes = await agent.post('/auth/login').send({
    email,
    password,
  });
  expect(loginRes.status).toBe(200);

  return agent;
};

describe('Admin subscription plans API', () => {
  beforeEach(async () => {
    await ensureSubscriptionCatalog(prisma);
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/admin/subscriptions/plans');
    expect(response.status).toBe(401);
  });

  it('rejects non-admin access', async () => {
    const userAgent = await createUserAgent();
    const response = await userAgent.get('/admin/subscriptions/plans');
    expect(response.status).toBe(403);
  });

  it('returns plans catalog for admin', async () => {
    const adminAgent = await createAdminAgent();
    const response = await adminAgent.get('/admin/subscriptions/plans');

    expect(response.status).toBe(200);
    expect(response.body.plans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'FREE' }),
        expect.objectContaining({ code: 'ADVANCED' }),
        expect.objectContaining({ code: 'PROFESSIONAL' }),
      ]),
    );
  });

  it('updates price and entitlement limits for selected plan', async () => {
    const adminAgent = await createAdminAgent();
    const before = await adminAgent.get('/admin/subscriptions/plans');
    expect(before.status).toBe(200);
    const freePlan = (before.body.plans as Array<{ code: string; entitlements: Record<string, unknown> }>).find(
      (item) => item.code === 'FREE',
    );
    expect(freePlan).toBeDefined();
    if (!freePlan) throw new Error('Expected FREE plan in admin list');

    const currentEntitlements = SubscriptionEntitlementsSchema.parse(freePlan.entitlements);

    const updateResponse = await adminAgent.put('/admin/subscriptions/plans/FREE').send({
      monthlyPriceMinor: 700,
      currency: 'usd',
      entitlements: {
        ...currentEntitlements,
        limits: {
          ...currentEntitlements.limits,
          maxBotsTotal: 2,
          maxBotsByMode: {
            PAPER: 2,
            LIVE: 0,
          },
        },
      },
    });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.code).toBe('FREE');
    expect(updateResponse.body.monthlyPriceMinor).toBe(700);
    expect(updateResponse.body.currency).toBe('USD');
    expect(updateResponse.body.entitlements.limits.maxBotsTotal).toBe(2);
    expect(updateResponse.body.entitlements.limits.maxBotsByMode).toEqual({
      PAPER: 2,
      LIVE: 0,
    });
  });

  it('returns 400 for invalid entitlements payload', async () => {
    const adminAgent = await createAdminAgent();
    const response = await adminAgent.put('/admin/subscriptions/plans/FREE').send({
      entitlements: {
        version: 1,
        limits: {
          maxBotsTotal: 1,
          maxBotsByMode: { PAPER: 2, LIVE: 0 },
          maxConcurrentBacktests: 1,
        },
        features: {
          liveTrading: false,
          syncExternalPositions: true,
          manageExternalPositions: false,
        },
        cadence: {
          allowedIntervals: ['5m'],
          defaultMarketScanInterval: '5m',
          defaultPositionScanInterval: '5m',
        },
      },
    });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Validation failed');
  });
});
