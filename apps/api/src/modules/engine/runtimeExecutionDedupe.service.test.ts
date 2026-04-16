import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../prisma/client';
import {
  buildCancelExecutionDedupeKey,
  buildCloseExecutionDedupeKey,
  buildDcaExecutionDedupeKey,
  buildOpenExecutionDedupeKey,
  isRuntimeExecutionRetryableErrorClass,
  RuntimeExecutionDedupeService,
} from './runtimeExecutionDedupe.service';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runtimeExecutionDedupe key builders', () => {
  it('builds deterministic OPEN dedupe key with normalized interval/symbol', () => {
    const key = buildOpenExecutionDedupeKey({
      userId: 'user-1',
      botId: 'bot-1',
      botMarketGroupId: 'group-1',
      symbol: 'btcusdt',
      interval: '1 min',
      candleOpenTime: 1_000,
      candleCloseTime: 59_000,
      direction: 'LONG',
    });

    expect(key).toBe('v1|OPEN|user-1|bot-1|BTCUSDT|group-1|1m|1000|59000|LONG');
  });

  it('builds CLOSE dedupe key with normalized reason code', () => {
    const key = buildCloseExecutionDedupeKey({
      userId: 'user-1',
      botId: 'bot-1',
      symbol: 'ETHUSDT',
      positionId: 'pos-1',
      closeReason: 'trailing_stop',
    });

    expect(key).toBe('v1|CLOSE|user-1|bot-1|ETHUSDT|pos-1|TSL');
  });

  it('builds DCA and CANCEL keys with stable scopes', () => {
    const dcaKey = buildDcaExecutionDedupeKey({
      userId: 'user-1',
      botId: 'bot-1',
      symbol: 'SOLUSDT',
      positionId: 'pos-1',
      dcaLevelIndex: 2,
      positionSide: 'SHORT',
    });
    const cancelKey = buildCancelExecutionDedupeKey({
      userId: 'user-1',
      botId: 'bot-1',
      symbol: 'SOLUSDT',
      orderId: 'order-1',
      reasonCode: 'runtime_dca_finalize',
    });

    expect(dcaKey).toBe('v1|DCA|user-1|bot-1|SOLUSDT|pos-1|level:2|SHORT');
    expect(cancelKey).toBe('v1|CANCEL|user-1|bot-1|SOLUSDT|order-1|runtime_dca_finalize');
  });
});

describe('runtimeExecutionDedupe retryability gate', () => {
  it('classifies retryable error classes with normalization', () => {
    expect(isRuntimeExecutionRetryableErrorClass('TimeoutError')).toBe(true);
    expect(isRuntimeExecutionRetryableErrorClass('fetch error')).toBe(true);
    expect(isRuntimeExecutionRetryableErrorClass('ValidationError')).toBe(false);
  });

  it('returns reused for FAILED terminal errors to avoid duplicate side effects', async () => {
    const service = new RuntimeExecutionDedupeService();
    vi.spyOn(prisma.runtimeExecutionDedupe, 'create').mockRejectedValue({ code: 'P2002' });
    vi.spyOn(prisma.runtimeExecutionDedupe, 'findUnique').mockResolvedValue({
      id: 'dedupe-1',
      dedupeKey: 'v1|OPEN|u1|bot-1|BTCUSDT|group-1|1m|1000|59000|LONG',
      dedupeVersion: 'v1',
      commandType: 'OPEN',
      userId: 'u1',
      botId: 'bot-1',
      symbol: 'BTCUSDT',
      status: 'FAILED',
      commandFingerprint: {},
      firstSeenAt: new Date('2026-04-16T10:00:00.000Z'),
      lastSeenAt: new Date('2026-04-16T10:00:00.000Z'),
      ttlExpiresAt: new Date('2026-04-17T10:00:00.000Z'),
      orderId: null,
      positionId: null,
      errorClass: 'validation_error',
      createdAt: new Date('2026-04-16T10:00:00.000Z'),
      updatedAt: new Date('2026-04-16T10:00:00.000Z'),
    } as never);
    const updateSpy = vi
      .spyOn(prisma.runtimeExecutionDedupe, 'update')
      .mockResolvedValue({} as never);

    const result = await service.acquire({
      dedupeKey: 'v1|OPEN|u1|bot-1|BTCUSDT|group-1|1m|1000|59000|LONG',
      commandType: 'OPEN',
      userId: 'u1',
      botId: 'bot-1',
      symbol: 'BTCUSDT',
      commandFingerprint: { test: true },
      now: new Date('2026-04-16T10:05:00.000Z'),
    });

    expect(result).toEqual({
      outcome: 'reused',
      dedupeKey: 'v1|OPEN|u1|bot-1|BTCUSDT|group-1|1m|1000|59000|LONG',
      orderId: null,
      positionId: null,
    });
    expect(updateSpy).toHaveBeenCalledWith({
      where: { dedupeKey: 'v1|OPEN|u1|bot-1|BTCUSDT|group-1|1m|1000|59000|LONG' },
      data: expect.objectContaining({
        lastSeenAt: new Date('2026-04-16T10:05:00.000Z'),
      }),
    });
  });

  it('allows retry execution for FAILED retryable errors', async () => {
    const service = new RuntimeExecutionDedupeService();
    vi.spyOn(prisma.runtimeExecutionDedupe, 'create').mockRejectedValue({ code: 'P2002' });
    vi.spyOn(prisma.runtimeExecutionDedupe, 'findUnique').mockResolvedValue({
      id: 'dedupe-2',
      dedupeKey: 'v1|CLOSE|u1|bot-1|BTCUSDT|position-1|EXIT',
      dedupeVersion: 'v1',
      commandType: 'CLOSE',
      userId: 'u1',
      botId: 'bot-1',
      symbol: 'BTCUSDT',
      status: 'FAILED',
      commandFingerprint: {},
      firstSeenAt: new Date('2026-04-16T10:00:00.000Z'),
      lastSeenAt: new Date('2026-04-16T10:00:00.000Z'),
      ttlExpiresAt: new Date('2026-04-17T10:00:00.000Z'),
      orderId: null,
      positionId: null,
      errorClass: 'timeout_error',
      createdAt: new Date('2026-04-16T10:00:00.000Z'),
      updatedAt: new Date('2026-04-16T10:00:00.000Z'),
    } as never);
    const updateSpy = vi
      .spyOn(prisma.runtimeExecutionDedupe, 'update')
      .mockResolvedValue({} as never);

    const result = await service.acquire({
      dedupeKey: 'v1|CLOSE|u1|bot-1|BTCUSDT|position-1|EXIT',
      commandType: 'CLOSE',
      userId: 'u1',
      botId: 'bot-1',
      symbol: 'BTCUSDT',
      commandFingerprint: { test: true },
      now: new Date('2026-04-16T10:05:00.000Z'),
    });

    expect(result).toEqual({
      outcome: 'execute',
      dedupeKey: 'v1|CLOSE|u1|bot-1|BTCUSDT|position-1|EXIT',
    });
    expect(updateSpy).toHaveBeenCalledWith({
      where: { dedupeKey: 'v1|CLOSE|u1|bot-1|BTCUSDT|position-1|EXIT' },
      data: expect.objectContaining({
        status: 'PENDING',
        errorClass: null,
      }),
    });
  });
});
