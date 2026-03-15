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

type BotLiveConfig = {
  mode: 'PAPER' | 'LIVE' | 'LOCAL';
  liveOptIn: boolean;
};

export interface BotReadStore {
  getBotLiveConfig(userId: string, botId: string): Promise<BotLiveConfig | null>;
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
        liveOptIn: true,
      },
    });
  }
}

const defaultReadStore = new PrismaPreTradeReadStore();

export const analyzePreTrade = async (
  input: PreTradeAnalysisInput,
  readStore: PreTradeReadStore = defaultReadStore
): Promise<PreTradeDecision> => {
  const parsed = PreTradeAnalysisInputSchema.parse(input);
  const reasons: string[] = [];

  const userOpenPositions = await readStore.countOpenByUser(parsed.userId);
  const botOpenPositions = parsed.botId
    ? await readStore.countOpenByBot(parsed.userId, parsed.botId)
    : null;
  const hasOpenPositionOnSymbol = parsed.enforceOnePositionPerSymbol
    ? await readStore.hasOpenPositionOnSymbol(parsed.userId, parsed.symbol)
    : false;

  if (parsed.mode === 'LIVE') {
    if (!parsed.botId) {
      reasons.push('live_bot_required');
    } else {
      const botLiveConfig = await readStore.getBotLiveConfig(parsed.userId, parsed.botId);
      if (!botLiveConfig) {
        reasons.push('live_bot_not_found');
      } else {
        if (botLiveConfig.mode !== 'LIVE') {
          reasons.push('live_mode_bot_required');
        }
        if (!botLiveConfig.liveOptIn) {
          reasons.push('live_opt_in_required');
        }
      }
    }
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
