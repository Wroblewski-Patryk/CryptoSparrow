import {
  BotRuntimeEventLevel,
  BotRuntimeEventType,
  BotRuntimeSessionStatus,
  Prisma,
  SignalDirection,
} from '@prisma/client';
import { prisma } from '../../prisma/client';
import { normalizeSymbol } from '../../lib/symbols';
import { runtimeMetricsService } from './runtimeMetrics.service';

type RuntimeMode = 'PAPER' | 'LIVE';

type EnsureRuntimeSessionInput = {
  userId: string;
  botId: string;
  mode: RuntimeMode;
};

type RecordRuntimeEventInput = {
  userId: string;
  botId: string;
  mode?: RuntimeMode;
  sessionId?: string;
  eventType: BotRuntimeEventType;
  level?: BotRuntimeEventLevel;
  symbol?: string;
  botMarketGroupId?: string;
  strategyId?: string;
  signalDirection?: SignalDirection;
  message?: string;
  payload?: Record<string, unknown>;
  eventAt?: Date;
};

type SymbolStatIncrements = {
  totalSignals?: number;
  longEntries?: number;
  shortEntries?: number;
  exits?: number;
  dcaCount?: number;
  closedTrades?: number;
  winningTrades?: number;
  losingTrades?: number;
  realizedPnl?: number;
  grossProfit?: number;
  grossLoss?: number;
  feesPaid?: number;
};

type UpsertSymbolStatInput = {
  userId: string;
  botId: string;
  mode?: RuntimeMode;
  sessionId?: string;
  symbol: string;
  increments?: SymbolStatIncrements;
  lastPrice?: number;
  lastSignalAt?: Date;
  lastTradeAt?: Date;
  openPositionCount?: number;
  openPositionQty?: number;
};

type CloseSessionInput = {
  botId: string;
  status: Exclude<BotRuntimeSessionStatus, 'RUNNING'>;
  stopReason?: string;
  errorMessage?: string;
};

type CachedSession = {
  sessionId: string;
  userId: string;
  mode: RuntimeMode;
};

type PendingSymbolStat = {
  userId: string;
  botId: string;
  sessionId: string;
  symbol: string;
  increments: SymbolStatIncrements;
  lastPrice?: number;
  lastSignalAt?: Date;
  lastTradeAt?: Date;
  openPositionCount?: number;
  openPositionQty?: number;
};

const runtimeTouchSessionThrottleMs = Math.max(
  0,
  Number.parseInt(process.env.RUNTIME_TELEMETRY_TOUCH_SESSION_THROTTLE_MS ?? '15000', 10)
);
const runtimeSymbolStatDebounceMs = Math.max(
  0,
  Number.parseInt(process.env.RUNTIME_TELEMETRY_SYMBOL_STAT_DEBOUNCE_MS ?? '250', 10)
);

const safeNumber = (value: number | undefined) =>
  Number.isFinite(value as number) ? (value as number) : undefined;

const resolveNewerDate = (current: Date | undefined, candidate: Date | undefined) => {
  if (!candidate) return current;
  if (!current) return candidate;
  return candidate.getTime() >= current.getTime() ? candidate : current;
};

export class RuntimeTelemetryService {
  private readonly botSessionCache = new Map<string, CachedSession>();
  private readonly lastTouchedSessionAtMs = new Map<string, number>();
  private readonly pendingSymbolStatsByKey = new Map<string, PendingSymbolStat>();
  private readonly symbolStatFlushTimersByKey = new Map<string, NodeJS.Timeout>();

  private buildSymbolStatKey(sessionId: string, symbol: string) {
    return `${sessionId}|${symbol}`;
  }

  private async cancelDuplicateRunningSessions(botId: string, keepSessionId: string) {
    const duplicates = await prisma.botRuntimeSession.findMany({
      where: {
        botId,
        status: 'RUNNING',
        id: {
          not: keepSessionId,
        },
      },
      select: {
        id: true,
      },
    });
    if (duplicates.length === 0) return;

    const duplicateIds = duplicates.map((session) => session.id);
    const now = new Date();
    await prisma.botRuntimeSession.updateMany({
      where: {
        id: {
          in: duplicateIds,
        },
        status: 'RUNNING',
      },
      data: {
        status: 'CANCELED',
        finishedAt: now,
        lastHeartbeatAt: now,
        stopReason: 'duplicate_running_session',
      },
    });
  }

  private mergeSymbolStatIncrements(
    base: SymbolStatIncrements,
    delta: SymbolStatIncrements | undefined
  ): SymbolStatIncrements {
    if (!delta) return base;
    return {
      totalSignals: (base.totalSignals ?? 0) + (delta.totalSignals ?? 0),
      longEntries: (base.longEntries ?? 0) + (delta.longEntries ?? 0),
      shortEntries: (base.shortEntries ?? 0) + (delta.shortEntries ?? 0),
      exits: (base.exits ?? 0) + (delta.exits ?? 0),
      dcaCount: (base.dcaCount ?? 0) + (delta.dcaCount ?? 0),
      closedTrades: (base.closedTrades ?? 0) + (delta.closedTrades ?? 0),
      winningTrades: (base.winningTrades ?? 0) + (delta.winningTrades ?? 0),
      losingTrades: (base.losingTrades ?? 0) + (delta.losingTrades ?? 0),
      realizedPnl: (base.realizedPnl ?? 0) + (delta.realizedPnl ?? 0),
      grossProfit: (base.grossProfit ?? 0) + (delta.grossProfit ?? 0),
      grossLoss: (base.grossLoss ?? 0) + (delta.grossLoss ?? 0),
      feesPaid: (base.feesPaid ?? 0) + (delta.feesPaid ?? 0),
    };
  }

  private queueSymbolStatUpsert(input: PendingSymbolStat) {
    const key = this.buildSymbolStatKey(input.sessionId, input.symbol);
    const existing = this.pendingSymbolStatsByKey.get(key);
    if (!existing) {
      this.pendingSymbolStatsByKey.set(key, {
        ...input,
        increments: this.mergeSymbolStatIncrements({}, input.increments),
      });
      return key;
    }

    existing.increments = this.mergeSymbolStatIncrements(existing.increments, input.increments);
    if (input.lastPrice !== undefined) existing.lastPrice = input.lastPrice;
    if (input.openPositionCount !== undefined) existing.openPositionCount = input.openPositionCount;
    if (input.openPositionQty !== undefined) existing.openPositionQty = input.openPositionQty;
    existing.lastSignalAt = resolveNewerDate(existing.lastSignalAt, input.lastSignalAt);
    existing.lastTradeAt = resolveNewerDate(existing.lastTradeAt, input.lastTradeAt);
    this.pendingSymbolStatsByKey.set(key, existing);
    return key;
  }

  private scheduleSymbolStatFlush(key: string) {
    const existingTimer = this.symbolStatFlushTimersByKey.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.symbolStatFlushTimersByKey.delete(key);
    }

    if (runtimeSymbolStatDebounceMs <= 0) {
      void this.flushSymbolStatByKey(key);
      return;
    }

    const timer = setTimeout(() => {
      this.symbolStatFlushTimersByKey.delete(key);
      void this.flushSymbolStatByKey(key);
    }, runtimeSymbolStatDebounceMs);
    timer.unref?.();
    this.symbolStatFlushTimersByKey.set(key, timer);
  }

  private async flushSymbolStatByKey(key: string) {
    const pending = this.pendingSymbolStatsByKey.get(key);
    if (!pending) return;
    this.pendingSymbolStatsByKey.delete(key);

    const now = new Date();
    await prisma.botRuntimeSymbolStat.upsert({
      where: {
        sessionId_symbol: {
          sessionId: pending.sessionId,
          symbol: pending.symbol,
        },
      },
      create: {
        userId: pending.userId,
        botId: pending.botId,
        sessionId: pending.sessionId,
        symbol: pending.symbol,
        totalSignals: pending.increments.totalSignals ?? 0,
        longEntries: pending.increments.longEntries ?? 0,
        shortEntries: pending.increments.shortEntries ?? 0,
        exits: pending.increments.exits ?? 0,
        dcaCount: pending.increments.dcaCount ?? 0,
        closedTrades: pending.increments.closedTrades ?? 0,
        winningTrades: pending.increments.winningTrades ?? 0,
        losingTrades: pending.increments.losingTrades ?? 0,
        realizedPnl: pending.increments.realizedPnl ?? 0,
        grossProfit: pending.increments.grossProfit ?? 0,
        grossLoss: pending.increments.grossLoss ?? 0,
        feesPaid: pending.increments.feesPaid ?? 0,
        openPositionCount: pending.openPositionCount ?? 0,
        openPositionQty: pending.openPositionQty ?? 0,
        lastPrice: safeNumber(pending.lastPrice),
        lastSignalAt: pending.lastSignalAt,
        lastTradeAt: pending.lastTradeAt,
        snapshotAt: now,
      },
      update: {
        totalSignals: { increment: pending.increments.totalSignals ?? 0 },
        longEntries: { increment: pending.increments.longEntries ?? 0 },
        shortEntries: { increment: pending.increments.shortEntries ?? 0 },
        exits: { increment: pending.increments.exits ?? 0 },
        dcaCount: { increment: pending.increments.dcaCount ?? 0 },
        closedTrades: { increment: pending.increments.closedTrades ?? 0 },
        winningTrades: { increment: pending.increments.winningTrades ?? 0 },
        losingTrades: { increment: pending.increments.losingTrades ?? 0 },
        realizedPnl: { increment: pending.increments.realizedPnl ?? 0 },
        grossProfit: { increment: pending.increments.grossProfit ?? 0 },
        grossLoss: { increment: pending.increments.grossLoss ?? 0 },
        feesPaid: { increment: pending.increments.feesPaid ?? 0 },
        ...(pending.openPositionCount !== undefined
          ? { openPositionCount: Math.max(0, Math.trunc(pending.openPositionCount)) }
          : {}),
        ...(pending.openPositionQty !== undefined
          ? { openPositionQty: Math.max(0, pending.openPositionQty) }
          : {}),
        ...(pending.lastPrice !== undefined ? { lastPrice: safeNumber(pending.lastPrice) } : {}),
        ...(pending.lastSignalAt ? { lastSignalAt: pending.lastSignalAt } : {}),
        ...(pending.lastTradeAt ? { lastTradeAt: pending.lastTradeAt } : {}),
        snapshotAt: now,
      },
    });
    runtimeMetricsService.recordSymbolStatsWrite();
    await this.touchSession(pending.sessionId);
  }

  private async flushPendingSymbolStatsForSessions(sessionIds: string[]) {
    if (sessionIds.length === 0) return;
    const sessionIdSet = new Set(sessionIds);
    const pendingKeys = Array.from(this.pendingSymbolStatsByKey.keys()).filter((key) => {
      const separatorIndex = key.indexOf('|');
      if (separatorIndex <= 0) return false;
      return sessionIdSet.has(key.slice(0, separatorIndex));
    });

    await Promise.all(
      pendingKeys.map(async (key) => {
        const timer = this.symbolStatFlushTimersByKey.get(key);
        if (timer) {
          clearTimeout(timer);
          this.symbolStatFlushTimersByKey.delete(key);
        }
        await this.flushSymbolStatByKey(key);
      })
    );
  }

  async ensureRuntimeSession(input: EnsureRuntimeSessionInput) {
    const cached = this.botSessionCache.get(input.botId);
    if (cached) {
      const cachedSession = await prisma.botRuntimeSession.findFirst({
        where: {
          id: cached.sessionId,
          botId: input.botId,
        },
        select: {
          id: true,
          userId: true,
          mode: true,
          status: true,
        },
      });
      if (cachedSession?.status === 'RUNNING') {
        this.botSessionCache.set(input.botId, {
          sessionId: cachedSession.id,
          userId: cachedSession.userId,
          mode: cachedSession.mode as RuntimeMode,
        });
        await this.cancelDuplicateRunningSessions(input.botId, cachedSession.id);
        await this.touchSession(cachedSession.id);
        return cachedSession.id;
      }
      this.botSessionCache.delete(input.botId);
    }

    const existingSessions = await prisma.botRuntimeSession.findMany({
      where: {
        botId: input.botId,
        status: 'RUNNING',
      },
      select: {
        id: true,
        userId: true,
        mode: true,
      },
      orderBy: [{ lastHeartbeatAt: 'desc' }, { startedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const existing = existingSessions[0];
    if (existing) {
      await this.cancelDuplicateRunningSessions(input.botId, existing.id);
      const sessionId = existing.id;
      this.botSessionCache.set(input.botId, {
        sessionId,
        userId: existing.userId,
        mode: existing.mode as RuntimeMode,
      });
      await this.touchSession(sessionId);
      return sessionId;
    }

    const now = new Date();
    const created = await prisma.botRuntimeSession.create({
      data: {
        userId: input.userId,
        botId: input.botId,
        mode: input.mode,
        status: 'RUNNING',
        lastHeartbeatAt: now,
        metadata: {
          source: 'runtime_signal_loop',
        },
      },
      select: {
        id: true,
      },
    });

    this.botSessionCache.set(input.botId, {
      sessionId: created.id,
      userId: input.userId,
      mode: input.mode,
    });
    this.lastTouchedSessionAtMs.set(created.id, now.getTime());

    await prisma.botRuntimeEvent.create({
      data: {
        userId: input.userId,
        botId: input.botId,
        sessionId: created.id,
        eventType: 'SESSION_STARTED',
        level: 'INFO',
        message: 'Runtime session started',
        eventAt: now,
      },
    });

    return created.id;
  }

  async closeRuntimeSession(input: CloseSessionInput) {
    const runningSessions = await prisma.botRuntimeSession.findMany({
      where: {
        botId: input.botId,
        status: 'RUNNING',
      },
      select: {
        id: true,
        userId: true,
        botId: true,
      },
      orderBy: {
        startedAt: 'desc',
      },
    });
    if (runningSessions.length === 0) {
      this.botSessionCache.delete(input.botId);
      return;
    }

    const sessionIds = runningSessions.map((session) => session.id);
    await this.flushPendingSymbolStatsForSessions(sessionIds);
    const now = new Date();
    await prisma.botRuntimeSession.updateMany({
      where: {
        id: { in: sessionIds },
        status: 'RUNNING',
      },
      data: {
        status: input.status,
        finishedAt: now,
        lastHeartbeatAt: now,
        stopReason: input.stopReason ?? null,
        errorMessage: input.errorMessage ?? null,
      },
    });

    await prisma.botRuntimeEvent.createMany({
      data: runningSessions.map((session) => ({
        userId: session.userId,
        botId: session.botId,
        sessionId: session.id,
        eventType: 'SESSION_STOPPED',
        level: input.status === 'FAILED' ? 'ERROR' : 'INFO',
        message: input.stopReason ?? 'Runtime session stopped',
        payload: input.errorMessage
          ? {
              errorMessage: input.errorMessage,
            }
          : undefined,
        eventAt: now,
      })),
    });

    this.botSessionCache.delete(input.botId);
    for (const sessionId of sessionIds) {
      this.lastTouchedSessionAtMs.delete(sessionId);
    }
  }

  async closeInactiveRuntimeSessions(activeBotIds: string[]) {
    const activeSet = new Set(activeBotIds);
    const runningRows = await prisma.botRuntimeSession.findMany({
      where: {
        status: 'RUNNING',
      },
      select: {
        botId: true,
      },
      distinct: ['botId'],
    });
    const runningBotIds = runningRows.map((row) => row.botId);
    const closeBotIds = runningBotIds.filter((botId) => !activeSet.has(botId));
    await Promise.all(
      closeBotIds.map((botId) =>
        this.closeRuntimeSession({
          botId,
          status: 'CANCELED',
          stopReason: 'bot_inactive',
        })
      )
    );
  }

  async recordRuntimeEvent(input: RecordRuntimeEventInput) {
    const sessionId =
      input.sessionId ??
      (input.mode
        ? await this.ensureRuntimeSession({
            userId: input.userId,
            botId: input.botId,
            mode: input.mode,
          })
        : await this.findRunningSessionId(input.botId));

    if (!sessionId) return;

    const eventAt = input.eventAt ?? new Date();
    await prisma.botRuntimeEvent.create({
      data: {
        userId: input.userId,
        botId: input.botId,
        sessionId,
        eventType: input.eventType,
        level: input.level ?? 'INFO',
        symbol: input.symbol ? normalizeSymbol(input.symbol) : undefined,
        botMarketGroupId: input.botMarketGroupId,
        strategyId: input.strategyId,
        signalDirection: input.signalDirection,
        message: input.message,
        payload: input.payload as Prisma.InputJsonValue | undefined,
        eventAt,
      },
    });

    await this.touchSession(sessionId);
  }

  async upsertRuntimeSymbolStat(input: UpsertSymbolStatInput) {
    const sessionId =
      input.sessionId ??
      (input.mode
        ? await this.ensureRuntimeSession({
            userId: input.userId,
            botId: input.botId,
            mode: input.mode,
          })
        : await this.findRunningSessionId(input.botId));

    if (!sessionId) return;

    const symbol = normalizeSymbol(input.symbol);
    const key = this.queueSymbolStatUpsert({
      userId: input.userId,
      botId: input.botId,
      sessionId,
      symbol,
      increments: input.increments ?? {},
      lastPrice: safeNumber(input.lastPrice),
      lastSignalAt: input.lastSignalAt,
      lastTradeAt: input.lastTradeAt,
      openPositionCount: input.openPositionCount,
      openPositionQty: input.openPositionQty,
    });
    this.scheduleSymbolStatFlush(key);
  }

  private async touchSession(sessionId: string) {
    const nowMs = Date.now();
    if (runtimeTouchSessionThrottleMs > 0) {
      const lastTouchedAtMs = this.lastTouchedSessionAtMs.get(sessionId);
      if (lastTouchedAtMs != null && nowMs - lastTouchedAtMs < runtimeTouchSessionThrottleMs) {
        return;
      }
    }

    await prisma.botRuntimeSession.update({
      where: { id: sessionId },
      data: {
        lastHeartbeatAt: new Date(),
      },
    });
    this.lastTouchedSessionAtMs.set(sessionId, nowMs);
    runtimeMetricsService.recordTouchSessionWrite();
  }

  private async findRunningSessionId(botId: string) {
    const running = await prisma.botRuntimeSession.findFirst({
      where: {
        botId,
        status: 'RUNNING',
      },
      select: {
        id: true,
        userId: true,
        mode: true,
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    if (!running) return null;
    this.botSessionCache.set(botId, {
      sessionId: running.id,
      userId: running.userId,
      mode: running.mode as RuntimeMode,
    });
    return running.id;
  }
}

export const runtimeTelemetryService = new RuntimeTelemetryService();
