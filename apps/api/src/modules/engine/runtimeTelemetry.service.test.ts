import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../prisma/client';
import { RuntimeTelemetryService } from './runtimeTelemetry.service';

describe('RuntimeTelemetryService.ensureRuntimeSession', () => {
  afterEach(() => {
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
    const touchSpy = vi.spyOn(prisma.botRuntimeSession, 'update').mockResolvedValue({
      id: 'session-running',
    } as any);
    const findManySpy = vi.spyOn(prisma.botRuntimeSession, 'findMany');
    const createSpy = vi.spyOn(prisma.botRuntimeSession, 'create');

    const sessionId = await service.ensureRuntimeSession({
      userId: 'user-1',
      botId: 'bot-1',
      mode: 'PAPER',
    });

    expect(sessionId).toBe('session-running');
    expect(touchSpy).toHaveBeenCalledTimes(1);
    expect(findManySpy).not.toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
  });
});

