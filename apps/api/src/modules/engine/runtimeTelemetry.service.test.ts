import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../prisma/client';
import { RuntimeTelemetryService } from './runtimeTelemetry.service';
import { metricsStore } from '../../observability/metrics';

describe('RuntimeTelemetryService.ensureRuntimeSession', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('creates a new running session when cached session is no longer RUNNING', async () => {
    const service = new RuntimeTelemetryService();
    (service as any).botSessionCache.set('bot-1', {
      sessionId: 'session-old',
      userId: 'user-1',
      mode: 'PAPER',
    });

    vi.spyOn(prisma.botRuntimeSession, 'findFirst').mockResolvedValue({
      id: 'session-old',
      userId: 'user-1',
      mode: 'PAPER',
      status: 'CANCELED',
    } as any);
    vi.spyOn(prisma.botRuntimeSession, 'findMany').mockResolvedValue([] as any);
    const createSpy = vi.spyOn(prisma.botRuntimeSession, 'create').mockResolvedValue({
      id: 'session-new',
    } as any);
    vi.spyOn(prisma.botRuntimeEvent, 'create').mockResolvedValue({ id: 'event-1' } as any);

    const sessionId = await service.ensureRuntimeSession({
      userId: 'user-1',
      botId: 'bot-1',
      mode: 'PAPER',
    });

    expect(sessionId).toBe('session-new');
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect((service as any).botSessionCache.get('bot-1')?.sessionId).toBe('session-new');
  });

  it('reuses cached running session and only updates heartbeat', async () => {
    const service = new RuntimeTelemetryService();
    (service as any).botSessionCache.set('bot-1', {
      sessionId: 'session-running',
      userId: 'user-1',
      mode: 'PAPER',
    });

    vi.spyOn(prisma.botRuntimeSession, 'findFirst').mockResolvedValue({
      id: 'session-running',
      userId: 'user-1',
      mode: 'PAPER',
      status: 'RUNNING',
    } as any);
    const findManySpy = vi.spyOn(prisma.botRuntimeSession, 'findMany').mockResolvedValue([] as any);
    const updateManySpy = vi.spyOn(prisma.botRuntimeSession, 'updateMany').mockResolvedValue({ count: 0 } as any);
    const touchSpy = vi.spyOn(prisma.botRuntimeSession, 'update').mockResolvedValue({
      id: 'session-running',
    } as any);
    const createSpy = vi.spyOn(prisma.botRuntimeSession, 'create');

    const sessionId = await service.ensureRuntimeSession({
      userId: 'user-1',
      botId: 'bot-1',
      mode: 'PAPER',
    });

    expect(sessionId).toBe('session-running');
    expect(touchSpy).toHaveBeenCalledTimes(1);
    expect(findManySpy).toHaveBeenCalledTimes(1);
    expect(updateManySpy).not.toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('cancels duplicate RUNNING sessions when cached session is valid', async () => {
    const service = new RuntimeTelemetryService();
    (service as any).botSessionCache.set('bot-1', {
      sessionId: 'session-running',
      userId: 'user-1',
      mode: 'PAPER',
    });

    vi.spyOn(prisma.botRuntimeSession, 'findFirst').mockResolvedValue({
      id: 'session-running',
      userId: 'user-1',
      mode: 'PAPER',
      status: 'RUNNING',
    } as any);
    vi.spyOn(prisma.botRuntimeSession, 'findMany').mockResolvedValue([{ id: 'session-dup' }] as any);
    const updateManySpy = vi.spyOn(prisma.botRuntimeSession, 'updateMany').mockResolvedValue({ count: 1 } as any);
    vi.spyOn(prisma.botRuntimeSession, 'update').mockResolvedValue({
      id: 'session-running',
    } as any);

    const sessionId = await service.ensureRuntimeSession({
      userId: 'user-1',
      botId: 'bot-1',
      mode: 'PAPER',
    });

    expect(sessionId).toBe('session-running');
    expect(updateManySpy).toHaveBeenCalledTimes(1);
    expect(updateManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['session-dup'] },
          status: 'RUNNING',
        }),
        data: expect.objectContaining({
          status: 'CANCELED',
          stopReason: 'duplicate_running_session',
        }),
      })
    );
  });

  it('records runtime telemetry write metrics after debounced symbol stat flush', async () => {
    vi.useFakeTimers();
    const service = new RuntimeTelemetryService();
    vi.spyOn(prisma.botRuntimeSymbolStat, 'upsert').mockResolvedValue({} as any);
    vi.spyOn(prisma.botRuntimeSession, 'update').mockResolvedValue({ id: 'session-1' } as any);

    const before = metricsStore.snapshot().runtime.hotPath;
    await service.upsertRuntimeSymbolStat({
      userId: 'user-1',
      botId: 'bot-1',
      sessionId: 'session-1',
      symbol: 'BTCUSDT',
      increments: {
        totalSignals: 1,
      },
    });
    await vi.advanceTimersByTimeAsync(300);
    const after = metricsStore.snapshot().runtime.hotPath;

    expect(after.symbolStatsWrites).toBeGreaterThanOrEqual(before.symbolStatsWrites + 1);
    expect(after.touchSessionWrites).toBeGreaterThanOrEqual(before.touchSessionWrites + 1);
  });

  it('batches symbol stat upserts for the same session and symbol within debounce window', async () => {
    vi.useFakeTimers();
    const service = new RuntimeTelemetryService();
    const upsertSpy = vi.spyOn(prisma.botRuntimeSymbolStat, 'upsert').mockResolvedValue({} as any);
    vi.spyOn(prisma.botRuntimeSession, 'update').mockResolvedValue({ id: 'session-1' } as any);

    await service.upsertRuntimeSymbolStat({
      userId: 'user-1',
      botId: 'bot-1',
      sessionId: 'session-1',
      symbol: 'BTCUSDT',
      increments: {
        totalSignals: 1,
        longEntries: 1,
      },
    });
    await service.upsertRuntimeSymbolStat({
      userId: 'user-1',
      botId: 'bot-1',
      sessionId: 'session-1',
      symbol: 'BTCUSDT',
      increments: {
        totalSignals: 2,
        shortEntries: 1,
      },
    });

    expect(upsertSpy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);

    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          totalSignals: { increment: 3 },
          longEntries: { increment: 1 },
          shortEntries: { increment: 1 },
        }),
      })
    );
  });

  it('throttles touchSession writes to once per configured window', async () => {
    vi.useFakeTimers();
    const service = new RuntimeTelemetryService();
    (service as any).botSessionCache.set('bot-1', {
      sessionId: 'session-running',
      userId: 'user-1',
      mode: 'PAPER',
    });

    vi.spyOn(prisma.botRuntimeSession, 'findFirst').mockResolvedValue({
      id: 'session-running',
      userId: 'user-1',
      mode: 'PAPER',
      status: 'RUNNING',
    } as any);
    vi.spyOn(prisma.botRuntimeSession, 'findMany').mockResolvedValue([] as any);
    const touchSpy = vi.spyOn(prisma.botRuntimeSession, 'update').mockResolvedValue({
      id: 'session-running',
    } as any);

    await service.ensureRuntimeSession({
      userId: 'user-1',
      botId: 'bot-1',
      mode: 'PAPER',
    });
    await service.ensureRuntimeSession({
      userId: 'user-1',
      botId: 'bot-1',
      mode: 'PAPER',
    });

    expect(touchSpy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(15_100);
    await service.ensureRuntimeSession({
      userId: 'user-1',
      botId: 'bot-1',
      mode: 'PAPER',
    });
    expect(touchSpy).toHaveBeenCalledTimes(2);
  });
});
