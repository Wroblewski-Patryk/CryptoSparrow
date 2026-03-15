import { prisma } from '../../prisma/client';
import {
  PreTradeAnalysisInput,
  PreTradeAnalysisInputSchema,
  PreTradeDecision,
} from './preTrade.types';

export interface PositionReadStore {
  countOpenByUser(userId: string): Promise<number>;
  countOpenByBot(userId: string, botId: string): Promise<number>;
  hasOpenPositionOnSymbol(userId: string, symbol: string): Promise<boolean>;
}

class PrismaPositionReadStore implements PositionReadStore {
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
}

const defaultPositionStore = new PrismaPositionReadStore();

export const analyzePreTrade = async (
  input: PreTradeAnalysisInput,
  positionStore: PositionReadStore = defaultPositionStore
): Promise<PreTradeDecision> => {
  const parsed = PreTradeAnalysisInputSchema.parse(input);
  const reasons: string[] = [];

  const userOpenPositions = await positionStore.countOpenByUser(parsed.userId);
  const botOpenPositions = parsed.botId
    ? await positionStore.countOpenByBot(parsed.userId, parsed.botId)
    : null;
  const hasOpenPositionOnSymbol = parsed.enforceOnePositionPerSymbol
    ? await positionStore.hasOpenPositionOnSymbol(parsed.userId, parsed.symbol)
    : false;

  if (parsed.mode === 'LIVE' && !parsed.liveOptIn) {
    reasons.push('live_opt_in_required');
  }

  if (
    typeof parsed.maxOpenPositionsPerUser === 'number' &&
    userOpenPositions >= parsed.maxOpenPositionsPerUser
  ) {
    reasons.push('user_open_positions_limit_reached');
  }

  if (
    parsed.botId &&
    typeof parsed.maxOpenPositionsPerBot === 'number' &&
    typeof botOpenPositions === 'number' &&
    botOpenPositions >= parsed.maxOpenPositionsPerBot
  ) {
    reasons.push('bot_open_positions_limit_reached');
  }

  if (hasOpenPositionOnSymbol) {
    reasons.push('open_position_on_symbol_exists');
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    metrics: {
      userOpenPositions,
      botOpenPositions,
      hasOpenPositionOnSymbol,
    },
  };
};
