import { beforeEach, describe, expect, it } from 'vitest';
import { analyzePreTrade } from './preTrade.service';
import { prisma } from '../../prisma/client';

describe('preTrade e2e smoke (paper/live critical paths)', () => {
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
    await prisma.bot.deleteMany();
    await prisma.symbolGroup.deleteMany();
    await prisma.marketUniverse.deleteMany();
    await prisma.strategy.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
  });

  it('allows LIVE pre-trade for opted-in bot and writes INFO audit log', async () => {
    const user = await prisma.user.create({
      data: { email: 'pretrade-live-ok@example.com', password: 'hashed-pass' },
    });
    const bot = await prisma.bot.create({
      data: {
        userId: user.id,
        name: 'Live bot',
        mode: 'LIVE',
        liveOptIn: true,
        consentTextVersion: 'mvp-v1',
        isActive: true,
      },
    });

    const decision = await analyzePreTrade({
      userId: user.id,
      botId: bot.id,
      symbol: 'BTCUSDT',
      mode: 'LIVE',
    });

    expect(decision.allowed).toBe(true);

    const logs = await prisma.log.findMany({
      where: {
        userId: user.id,
        botId: bot.id,
        source: 'engine.pre-trade',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('trade.precheck.allowed');
    expect(logs[0].level).toBe('INFO');
  });

  it('blocks LIVE pre-trade when kill-switch is enabled and writes WARN audit log', async () => {
    const user = await prisma.user.create({
      data: { email: 'pretrade-live-stop@example.com', password: 'hashed-pass' },
    });
    const bot = await prisma.bot.create({
      data: {
        userId: user.id,
        name: 'Live bot guarded',
        mode: 'LIVE',
        liveOptIn: true,
        consentTextVersion: 'mvp-v1',
        isActive: true,
      },
    });

    const decision = await analyzePreTrade({
      userId: user.id,
      botId: bot.id,
      symbol: 'ETHUSDT',
      mode: 'LIVE',
      globalKillSwitch: true,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('global_kill_switch_enabled');

    const log = await prisma.log.findFirstOrThrow({
      where: {
        userId: user.id,
        botId: bot.id,
        source: 'engine.pre-trade',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(log.action).toBe('trade.precheck.blocked');
    expect(log.level).toBe('WARN');
  });

  it('blocks PAPER pre-trade on open symbol position and writes WARN audit log', async () => {
    const user = await prisma.user.create({
      data: { email: 'pretrade-paper-block@example.com', password: 'hashed-pass' },
    });

    await prisma.position.create({
      data: {
        userId: user.id,
        symbol: 'SOLUSDT',
        side: 'LONG',
        entryPrice: 100,
        quantity: 1,
      },
    });

    const decision = await analyzePreTrade({
      userId: user.id,
      symbol: 'SOLUSDT',
      mode: 'PAPER',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('open_position_on_symbol_exists');

    const log = await prisma.log.findFirstOrThrow({
      where: { userId: user.id, source: 'engine.pre-trade' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log.action).toBe('trade.precheck.blocked');
    expect(log.level).toBe('WARN');
  });
});

