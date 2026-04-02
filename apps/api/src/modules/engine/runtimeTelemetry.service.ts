import {
  BotRuntimeEventLevel,
  BotRuntimeEventType,
  BotRuntimeSessionStatus,
  Prisma,
  SignalDirection,
} from '@prisma/client';
import { prisma } from '../../prisma/client';

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

const normalizeSymbol = (symbol: string) => symbol.trim().toUpperCase();
const safeNumber = (value: number | undefined) =>
  Number.isFinite(value as number) ? (value as number) : undefined;

export class RuntimeTelemetryService {
  private readonly botSessionCache = new Map<string, CachedSession>();

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
      orderBy: {
        startedAt: 'desc',
      },
    });

    const existing = existingSessions[0];
    if (existing) {
      const duplicates = existingSessions.slice(1).map((session) => session.id);
      if (duplicates.length > 0) {
        const now = new Date();
        await prisma.botRuntimeSession.updateMany({
          where: {
            id: { in: duplicates },
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
    const increments = input.increments ?? {};
    const now = new Date();

    await prisma.botRuntimeSymbolStat.upsert({
      where: {
        sessionId_symbol: {
          sessionId,
          symbol,
        },
      },
      create: {
        userId: input.userId,
        botId: input.botId,
        sessionId,
        symbol,
        totalSignals: increments.totalSignals ?? 0,
        longEntries: increments.longEntries ?? 0,
        shortEntries: increments.shortEntries ?? 0,
        exits: increments.exits ?? 0,
        dcaCount: increments.dcaCount ?? 0,
        closedTrades: increments.closedTrades ?? 0,
        winningTrades: increments.winningTrades ?? 0,
        losingTrades: increments.losingTrades ?? 0,
        realizedPnl: increments.realizedPnl ?? 0,
        grossProfit: increments.grossProfit ?? 0,
        grossLoss: increments.grossLoss ?? 0,
        feesPaid: increments.feesPaid ?? 0,
        openPositionCount: input.openPositionCount ?? 0,
        openPositionQty: input.openPositionQty ?? 0,
        lastPrice: safeNumber(input.lastPrice),
        lastSignalAt: input.lastSignalAt,
        lastTradeAt: input.lastTradeAt,
        snapshotAt: now,
      },
      update: {
        totalSignals: { increment: increments.totalSignals ?? 0 },
        longEntries: { increment: increments.longEntries ?? 0 },
        shortEntries: { increment: increments.shortEntries ?? 0 },
        exits: { increment: increments.exits ?? 0 },
        dcaCount: { increment: increments.dcaCount ?? 0 },
        closedTrades: { increment: increments.closedTrades ?? 0 },
        winningTrades: { increment: increments.winningTrades ?? 0 },
        losingTrades: { increment: increments.losingTrades ?? 0 },
        realizedPnl: { increment: increments.realizedPnl ?? 0 },
        grossProfit: { increment: increments.grossProfit ?? 0 },
        grossLoss: { increment: increments.grossLoss ?? 0 },
        feesPaid: { increment: increments.feesPaid ?? 0 },
        ...(input.openPositionCount !== undefined
          ? { openPositionCount: Math.max(0, Math.trunc(input.openPositionCount)) }
          : {}),
        ...(input.openPositionQty !== undefined
          ? { openPositionQty: Math.max(0, input.openPositionQty) }
          : {}),
        ...(input.lastPrice !== undefined ? { lastPrice: safeNumber(input.lastPrice) } : {}),
        ...(input.lastSignalAt ? { lastSignalAt: input.lastSignalAt } : {}),
        ...(input.lastTradeAt ? { lastTradeAt: input.lastTradeAt } : {}),
        snapshotAt: now,
      },
    });

    await this.touchSession(sessionId);
  }

  private async touchSession(sessionId: string) {
    await prisma.botRuntimeSession.update({
      where: { id: sessionId },
      data: {
        lastHeartbeatAt: new Date(),
      },
    });
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
