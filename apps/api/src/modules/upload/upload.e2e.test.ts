import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
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

describe('Avatar upload security contract', () => {
  beforeEach(async () => {
    await prisma.orderFill.deleteMany();
    await prisma.trade.deleteMany();
    await prisma.order.deleteMany();
    await prisma.position.deleteMany();
    await prisma.signal.deleteMany();
    await prisma.backtestTrade.deleteMany();
    await prisma.backtestReport.deleteMany();
    await prisma.backtestRun.deleteMany();
    await prisma.log.deleteMany();
    await prisma.runtimeExecutionDedupe.deleteMany();
    await prisma.botRuntimeEvent.deleteMany();
    await prisma.botRuntimeSymbolStat.deleteMany();
    await prisma.botRuntimeSession.deleteMany();
    await prisma.botStrategy.deleteMany();
    await prisma.botSubagentConfig.deleteMany();
    await prisma.botAssistantConfig.deleteMany();
    await prisma.marketGroupStrategyLink.deleteMany();
    await prisma.botMarketGroup.deleteMany();
    await prisma.bot.deleteMany();
    await prisma.symbolGroup.deleteMany();
    await prisma.marketUniverse.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.user.deleteMany();
  });

  it('rejects unauthenticated upload', async () => {
    const pngBuffer = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#ff0000' },
    })
      .png()
      .toBuffer();

    const res = await request(app)
      .post('/upload/avatar')
      .attach('avatar', pngBuffer, {
        filename: 'avatar.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Missing token');
  });

  it('rejects unsupported mime type', async () => {
    const agent = await registerAndLogin('upload-user@example.com');

    const res = await agent
      .post('/upload/avatar')
      .attach('avatar', Buffer.from('not-an-image'), {
        filename: 'avatar.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Unsupported file type');
  });

  it('rejects oversized avatar payload above 2MB', async () => {
    const agent = await registerAndLogin('upload-user-too-large@example.com');
    const oversizedBuffer = Buffer.alloc(2 * 1024 * 1024 + 1, 1);

    const res = await agent
      .post('/upload/avatar')
      .attach('avatar', oversizedBuffer, {
        filename: 'avatar.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(413);
    expect(res.body.error.message).toBe('Avatar file too large (max 2MB)');
  });

  it('uploads supported image when authenticated', async () => {
    const agent = await registerAndLogin('upload-user-ok@example.com');
    const pngBuffer = await sharp({
      create: { width: 16, height: 16, channels: 3, background: '#00ff00' },
    })
      .png()
      .toBuffer();

    const res = await agent.post('/upload/avatar').attach('avatar', pngBuffer, {
      filename: 'avatar.png',
      contentType: 'image/png',
    });

    expect(res.status).toBe(200);
    expect(typeof res.body.url).toBe('string');
    expect(res.body.url).toMatch(/\/avatars\/.+\.jpg$/);
  });

  it('uses forwarded origin for avatar URL behind proxy', async () => {
    const agent = await registerAndLogin('upload-user-proxy@example.com');
    const pngBuffer = await sharp({
      create: { width: 16, height: 16, channels: 3, background: '#0000ff' },
    })
      .png()
      .toBuffer();

    const res = await agent
      .post('/upload/avatar')
      .set('X-Forwarded-Proto', 'https')
      .set('X-Forwarded-Host', 'app.soar.example')
      .attach('avatar', pngBuffer, {
        filename: 'avatar.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/^https:\/\/app\.soar\.example\/avatars\/.+\.jpg$/);
  });
});


