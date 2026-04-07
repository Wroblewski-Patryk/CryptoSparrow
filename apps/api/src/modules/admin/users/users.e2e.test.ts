import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../../index';
import { prisma } from '../../../prisma/client';
import { ensureSubscriptionCatalog } from '../../subscriptions/subscriptions.service';

const createAgent = async (role: 'USER' | 'ADMIN' = 'USER') => {
  const email = `admin-users-${role.toLowerCase()}-${Date.now()}-${Math.random()}@example.com`;
  const password = 'AdminUsers12#$';
  const agent = request.agent(app);

  const registerRes = await agent.post('/auth/register').send({ email, password });
  expect(registerRes.status).toBe(201);

  if (role === 'ADMIN') {
    await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN' },
    });
  }

  const loginRes = await agent.post('/auth/login').send({ email, password });
  expect(loginRes.status).toBe(200);

  const meRes = await agent.get('/auth/me');
  expect(meRes.status).toBe(200);

  return {
    agent,
    user: {
      id: meRes.body.id as string,
      email: meRes.body.email as string,
    },
  };
};

describe('Admin users API', () => {
  beforeEach(async () => {
    await ensureSubscriptionCatalog(prisma, { seedDefaults: true });
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/admin/users');
    expect(response.status).toBe(401);
  });

  it('rejects non-admin access', async () => {
    const regular = await createAgent('USER');
    const response = await regular.agent.get('/admin/users');
    expect(response.status).toBe(403);
  });

  it('lists users for admin with active subscription metadata', async () => {
    const admin = await createAgent('ADMIN');
    const regular = await createAgent('USER');

    const response = await admin.agent.get('/admin/users').query({
      search: regular.user.email,
      page: 1,
      pageSize: 10,
    });

    expect(response.status).toBe(200);
    expect(response.body.meta.page).toBe(1);
    expect(response.body.meta.pageSize).toBe(10);
    expect(response.body.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: regular.user.id,
          email: regular.user.email,
          role: 'USER',
          activeSubscription: expect.objectContaining({
            planCode: 'FREE',
          }),
        }),
      ]),
    );
  });

  it('updates user role and subscription plan', async () => {
    const admin = await createAgent('ADMIN');
    const regular = await createAgent('USER');

    const promoteRes = await admin.agent.patch(`/admin/users/${regular.user.id}`).send({
      role: 'ADMIN',
    });
    expect(promoteRes.status).toBe(200);
    expect(promoteRes.body.role).toBe('ADMIN');

    const assignPlanRes = await admin.agent.patch(`/admin/users/${regular.user.id}`).send({
      subscriptionPlanCode: 'ADVANCED',
    });
    expect(assignPlanRes.status).toBe(200);
    expect(assignPlanRes.body.activeSubscription.planCode).toBe('ADVANCED');
    expect(assignPlanRes.body.activeSubscription.source).toBe('ADMIN_OVERRIDE');
  });

  it('blocks self demotion', async () => {
    const admin = await createAgent('ADMIN');

    const response = await admin.agent.patch(`/admin/users/${admin.user.id}`).send({
      role: 'USER',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('You cannot demote your own admin account');
  });
});

