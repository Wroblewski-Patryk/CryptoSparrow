import { Prisma, RuntimeExecutionCommandType } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { normalizeSymbol } from '../../lib/symbols';

const dedupeVersion = 'v1';

const toPositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const openRetentionMs = toPositiveInteger(process.env.RUNTIME_SIGNAL_DEDUPE_RETENTION_MS, 21_600_000);
const defaultRetentionMs = toPositiveInteger(process.env.RUNTIME_EXECUTION_DEDUPE_RETENTION_MS, 86_400_000);
const pendingStaleMs = toPositiveInteger(process.env.RUNTIME_EXECUTION_DEDUPE_PENDING_STALE_MS, 120_000);

const normalizeInterval = (value?: string | null) => {
  if (!value) return '1m';
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, string> = {
    '1 min': '1m',
    '3 min': '3m',
    '5 min': '5m',
    '10 min': '10m',
    '15 min': '15m',
    '30 min': '30m',
    '60 min': '1h',
  };
  return aliases[normalized] ?? normalized;
};

const normalizeCloseReason = (
  value?: 'take_profit' | 'trailing_take_profit' | 'stop_loss' | 'trailing_stop' | string
) => {
  if (!value) return 'EXIT';
  const reason = String(value).trim().toLowerCase();
  if (reason === 'take_profit' || reason === 'tp') return 'TP';
  if (reason === 'trailing_take_profit' || reason === 'ttp') return 'TTP';
  if (reason === 'stop_loss' || reason === 'sl') return 'SL';
  if (reason === 'trailing_stop' || reason === 'tsl') return 'TSL';
  if (reason === 'liquidation') return 'LIQUIDATION';
  if (reason === 'floor') return 'FLOOR';
  return 'EXIT';
};

const normalizeErrorClass = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, '_')
    .slice(0, 80) || 'runtime_execution_error';

const toPrismaJson = (value: Record<string, unknown>): Prisma.InputJsonValue =>
  value as unknown as Prisma.InputJsonValue;

const isUniqueViolation = (error: unknown) => (error as { code?: string })?.code === 'P2002';

const resolveRetentionMs = (commandType: RuntimeExecutionCommandType) =>
  commandType === 'OPEN' ? openRetentionMs : defaultRetentionMs;

const resolveTtlExpiresAt = (commandType: RuntimeExecutionCommandType, now: Date) =>
  new Date(now.getTime() + resolveRetentionMs(commandType));

const buildDedupeKeyBase = (input: {
  commandType: RuntimeExecutionCommandType;
  userId: string;
  botId?: string | null;
  symbol?: string | null;
  windowScope: string;
  intentScope: string;
}) => {
  const botScope = input.botId ? input.botId : 'manual';
  const symbolScope = input.symbol ? normalizeSymbol(input.symbol) : 'na';
  return [
    dedupeVersion,
    input.commandType,
    input.userId,
    botScope,
    symbolScope,
    input.windowScope,
    input.intentScope,
  ].join('|');
};

export const buildOpenExecutionDedupeKey = (input: {
  userId: string;
  botId: string;
  botMarketGroupId: string;
  symbol: string;
  interval: string;
  candleOpenTime: number;
  candleCloseTime: number;
  direction: 'LONG' | 'SHORT';
}) =>
  buildDedupeKeyBase({
    commandType: 'OPEN',
    userId: input.userId,
    botId: input.botId,
    symbol: input.symbol,
    windowScope: [
      input.botMarketGroupId,
      normalizeInterval(input.interval),
      String(input.candleOpenTime),
      String(input.candleCloseTime),
    ].join('|'),
    intentScope: input.direction,
  });

export const buildDcaExecutionDedupeKey = (input: {
  userId: string;
  botId?: string | null;
  symbol: string;
  positionId: string;
  dcaLevelIndex: number;
  positionSide: 'LONG' | 'SHORT';
}) =>
  buildDedupeKeyBase({
    commandType: 'DCA',
    userId: input.userId,
    botId: input.botId,
    symbol: input.symbol,
    windowScope: `${input.positionId}|level:${Math.max(0, Math.floor(input.dcaLevelIndex))}`,
    intentScope: input.positionSide,
  });

export const buildCloseExecutionDedupeKey = (input: {
  userId: string;
  botId?: string | null;
  symbol: string;
  positionId: string;
  closeReason?: 'take_profit' | 'trailing_take_profit' | 'stop_loss' | 'trailing_stop' | string;
}) =>
  buildDedupeKeyBase({
    commandType: 'CLOSE',
    userId: input.userId,
    botId: input.botId,
    symbol: input.symbol,
    windowScope: input.positionId,
    intentScope: normalizeCloseReason(input.closeReason),
  });

export const buildCancelExecutionDedupeKey = (input: {
  userId: string;
  botId?: string | null;
  symbol?: string | null;
  orderId: string;
  reasonCode?: string;
}) =>
  buildDedupeKeyBase({
    commandType: 'CANCEL',
    userId: input.userId,
    botId: input.botId,
    symbol: input.symbol,
    windowScope: input.orderId,
    intentScope: input.reasonCode?.trim() || 'runtime_cancel',
  });

type AcquireInput = {
  dedupeKey: string;
  commandType: RuntimeExecutionCommandType;
  userId: string;
  botId?: string | null;
  symbol?: string | null;
  commandFingerprint: Record<string, unknown>;
  now?: Date;
};

export type RuntimeExecutionDedupeAcquireResult =
  | {
      outcome: 'execute';
      dedupeKey: string;
    }
  | {
      outcome: 'reused';
      dedupeKey: string;
      orderId?: string | null;
      positionId?: string | null;
    }
  | {
      outcome: 'inflight';
      dedupeKey: string;
    };

type MarkSuccessInput = {
  dedupeKey: string;
  orderId?: string | null;
  positionId?: string | null;
  now?: Date;
};

type MarkFailedInput = {
  dedupeKey: string;
  errorClass: string;
  now?: Date;
};

export class RuntimeExecutionDedupeService {
  async acquire(input: AcquireInput): Promise<RuntimeExecutionDedupeAcquireResult> {
    const now = input.now ?? new Date();
    const ttlExpiresAt = resolveTtlExpiresAt(input.commandType, now);
    try {
      await prisma.runtimeExecutionDedupe.create({
        data: {
          dedupeKey: input.dedupeKey,
          dedupeVersion,
          commandType: input.commandType,
          userId: input.userId,
          botId: input.botId ?? null,
          symbol: input.symbol ? normalizeSymbol(input.symbol) : null,
          status: 'PENDING',
          commandFingerprint: toPrismaJson(input.commandFingerprint),
          firstSeenAt: now,
          lastSeenAt: now,
          ttlExpiresAt,
        },
      });
      return { outcome: 'execute', dedupeKey: input.dedupeKey };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }

    const existing = await prisma.runtimeExecutionDedupe.findUnique({
      where: { dedupeKey: input.dedupeKey },
    });
    if (!existing) {
      return { outcome: 'execute', dedupeKey: input.dedupeKey };
    }

    if (existing.status === 'SUCCEEDED') {
      await prisma.runtimeExecutionDedupe.update({
        where: { dedupeKey: input.dedupeKey },
        data: {
          lastSeenAt: now,
        },
      });
      return {
        outcome: 'reused',
        dedupeKey: input.dedupeKey,
        orderId: existing.orderId,
        positionId: existing.positionId,
      };
    }

    if (existing.status === 'PENDING') {
      const stalePending = now.getTime() - existing.lastSeenAt.getTime() >= pendingStaleMs;
      if (!stalePending) {
        await prisma.runtimeExecutionDedupe.update({
          where: { dedupeKey: input.dedupeKey },
          data: {
            lastSeenAt: now,
          },
        });
        return { outcome: 'inflight', dedupeKey: input.dedupeKey };
      }
    }

    await prisma.runtimeExecutionDedupe.update({
      where: { dedupeKey: input.dedupeKey },
      data: {
        status: 'PENDING',
        dedupeVersion,
        commandType: input.commandType,
        userId: input.userId,
        botId: input.botId ?? null,
        symbol: input.symbol ? normalizeSymbol(input.symbol) : null,
        commandFingerprint: toPrismaJson(input.commandFingerprint),
        lastSeenAt: now,
        ttlExpiresAt,
        orderId: null,
        positionId: null,
        errorClass: null,
      },
    });
    return { outcome: 'execute', dedupeKey: input.dedupeKey };
  }

  async markSucceeded(input: MarkSuccessInput) {
    const now = input.now ?? new Date();
    await prisma.runtimeExecutionDedupe.update({
      where: { dedupeKey: input.dedupeKey },
      data: {
        status: 'SUCCEEDED',
        lastSeenAt: now,
        orderId: input.orderId ?? null,
        positionId: input.positionId ?? null,
        errorClass: null,
      },
    });
  }

  async markFailed(input: MarkFailedInput) {
    const now = input.now ?? new Date();
    await prisma.runtimeExecutionDedupe.update({
      where: { dedupeKey: input.dedupeKey },
      data: {
        status: 'FAILED',
        lastSeenAt: now,
        errorClass: normalizeErrorClass(input.errorClass),
      },
    });
  }
}

export const runtimeExecutionDedupeService = new RuntimeExecutionDedupeService();
