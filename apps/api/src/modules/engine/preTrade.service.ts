import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client';
import {
  PreTradeAnalysisInput,
  PreTradeAnalysisInputSchema,
  PreTradeBotLiveConfig,
  PreTradeDecision,
} from './preTrade.types';
import { evaluatePreTradeRiskReasons } from './preTradeRisk.service';

export interface PositionReadStore {
  countOpenByUser(userId: string): Promise<number>;
  countOpenByBot(userId: string, botId: string): Promise<number>;
  hasOpenPositionOnSymbol(userId: string, symbol: string): Promise<boolean>;
}

type PreTradeAuditEntry = {
  userId: string;
  botId?: string;
  action: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  source: string;
  message: string;
  category: string;
  entityType?: string;
  entityId?: string;
  metadata: Prisma.InputJsonValue;
};

export interface BotReadStore {
  getBotLiveConfig(userId: string, botId: string): Promise<PreTradeBotLiveConfig | null>;
}

export interface AuditLogWriter {
  write(entry: PreTradeAuditEntry): Promise<void>;
}

type PreTradeReadStore = PositionReadStore & BotReadStore;

class PrismaPreTradeReadStore implements PreTradeReadStore {
  async countOpenByUser(userId: string) {
    return prisma.position.count({
      where: { userId, status: 'OPEN' },
    });
  }

  async countOpenByBot(userId: string, botId: string) {
    return prisma.position.count({
      where: { userId, botId, status: 'OPEN' },
    });
  }

  async hasOpenPositionOnSymbol(userId: string, symbol: string) {
    const found = await prisma.position.findFirst({
      where: { userId, symbol, status: 'OPEN' },
      select: { id: true },
    });
    return Boolean(found);
  }

  async getBotLiveConfig(userId: string, botId: string) {
    return prisma.bot.findFirst({
      where: { id: botId, userId },
      select: {
        mode: true,
        marketType: true,
        positionMode: true,
        liveOptIn: true,
        consentTextVersion: true,
      },
    });
  }
}

const defaultReadStore = new PrismaPreTradeReadStore();

class PrismaAuditLogWriter implements AuditLogWriter {
  async write(entry: PreTradeAuditEntry) {
    await prisma.log.create({
      data: {
        userId: entry.userId,
        botId: entry.botId,
        action: entry.action,
        level: entry.level,
        source: entry.source,
        message: entry.message,
        category: entry.category,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata,
      },
    });
  }
}

const defaultAuditLogWriter = new PrismaAuditLogWriter();

export const analyzePreTrade = async (
  input: PreTradeAnalysisInput,
  readStore: PreTradeReadStore = defaultReadStore,
  auditLogWriter: AuditLogWriter = defaultAuditLogWriter
): Promise<PreTradeDecision> => {
  const parsed = PreTradeAnalysisInputSchema.parse(input);

  const userOpenPositions = await readStore.countOpenByUser(parsed.userId);
  const botOpenPositions = parsed.botId
    ? await readStore.countOpenByBot(parsed.userId, parsed.botId)
    : null;
  const hasOpenPositionOnSymbol = parsed.enforceOnePositionPerSymbol
    ? await readStore.hasOpenPositionOnSymbol(parsed.userId, parsed.symbol)
    : false;
  const botLiveConfig = parsed.botId
    ? await readStore.getBotLiveConfig(parsed.userId, parsed.botId)
    : null;
  const reasons = evaluatePreTradeRiskReasons({
    parsed,
    userOpenPositions,
    botOpenPositions,
    hasOpenPositionOnSymbol,
    botLiveConfig,
  });

  const decision = {
    allowed: reasons.length === 0,
    reasons,
    metrics: {
      userOpenPositions,
      botOpenPositions,
      hasOpenPositionOnSymbol,
    },
  };

  const isCriticalDecision = parsed.mode === 'LIVE' || reasons.length > 0;
  if (isCriticalDecision) {
    try {
      await auditLogWriter.write({
        userId: parsed.userId,
        botId: parsed.botId,
        action: decision.allowed ? 'trade.precheck.allowed' : 'trade.precheck.blocked',
        level: decision.allowed ? 'INFO' : 'WARN',
        source: 'engine.pre-trade',
        message: decision.allowed
          ? `Pre-trade check allowed (${parsed.mode}) for ${parsed.symbol}`
          : `Pre-trade check blocked (${parsed.mode}) for ${parsed.symbol}`,
        category: 'TRADING_DECISION',
        entityType: parsed.botId ? 'BOT' : undefined,
        entityId: parsed.botId,
        metadata: {
          symbol: parsed.symbol,
          mode: parsed.mode,
          requestedMarketType: parsed.marketType ?? null,
          marketType: botLiveConfig?.marketType ?? null,
          positionMode: botLiveConfig?.positionMode ?? null,
          reasons: decision.reasons,
          metrics: decision.metrics,
          guardrails: {
            globalKillSwitch: parsed.globalKillSwitch,
            emergencyStop: parsed.emergencyStop,
          },
        },
      });
    } catch {
      // Audit logging failures must not block risk checks.
    }
  }

  return decision;
};
