import { normalizeSymbol } from '@/lib/symbols';
import { toTimestamp } from '@/lib/time';
import type {
  BotRuntimePositionsResponse,
  BotRuntimeSymbolStatsResponse,
  BotRuntimeTrade,
} from '@/features/bots/types/bot.type';
import {
  toProtectedPnlPercentFromStopPrice,
} from '@/features/bots/utils/trailingStopDisplay';
import type { OpenPositionWithLive, RuntimeSnapshot } from './types';

export const resolveUsedMargin = (positions: BotRuntimePositionsResponse | null) =>
  (positions?.openItems ?? []).reduce((sum, position) => {
    const leverage = Number.isFinite(position.leverage) && position.leverage > 0 ? position.leverage : 1;
    return sum + position.entryNotional / leverage;
  }, 0);

export const resolveDynamicTtpDisplay = (position: OpenPositionWithLive) =>
  toProtectedPnlPercentFromStopPrice({
    side: position.side,
    entryPrice: position.entryPrice,
    leverage: position.leverage,
    stopPrice: position.dynamicTtpStopLoss,
  }) ?? position.fallbackTtpProtectedPercent ?? null;

export const resolveDynamicTslDisplay = (position: OpenPositionWithLive) => {
  if (resolveDynamicTtpDisplay(position) != null) return null;
  return toProtectedPnlPercentFromStopPrice({
    side: position.side,
    entryPrice: position.entryPrice,
    leverage: position.leverage,
    stopPrice: position.dynamicTslStopLoss,
  });
};

export const buildLiveOpenPositions = (
  positions: BotRuntimePositionsResponse | null,
  symbolStats: BotRuntimeSymbolStatsResponse | null,
  streamPrices: Map<string, number>
): OpenPositionWithLive[] => {
  const priceBySymbol = new Map<string, number>();
  for (const item of symbolStats?.items ?? []) {
    if (typeof item.lastPrice === 'number' && Number.isFinite(item.lastPrice) && item.lastPrice > 0) {
      priceBySymbol.set(normalizeSymbol(item.symbol), item.lastPrice);
    }
  }

  return (positions?.openItems ?? []).map((position) => {
    const symbolKey = normalizeSymbol(position.symbol);
    const leverage = Number.isFinite(position.leverage) && position.leverage > 0 ? position.leverage : 1;
    const marginNotional = position.entryNotional / leverage;
    const candidateMark =
      streamPrices.get(symbolKey) ?? priceBySymbol.get(symbolKey) ?? position.markPrice ?? null;
    const liveMarkPrice = typeof candidateMark === 'number' && Number.isFinite(candidateMark) ? candidateMark : null;
    const hasPriceContext = liveMarkPrice != null || position.unrealizedPnl != null;
    const grossLiveUnrealizedPnl =
      liveMarkPrice == null
        ? (position.unrealizedPnl ?? 0)
        : position.side === 'LONG'
          ? (liveMarkPrice - position.entryPrice) * position.quantity
          : (position.entryPrice - liveMarkPrice) * position.quantity;
    const liveUnrealizedPnl = hasPriceContext ? grossLiveUnrealizedPnl : 0;
    const livePnlPct = marginNotional > 0 ? (liveUnrealizedPnl / marginNotional) * 100 : 0;

    return {
      ...position,
      liveMarkPrice,
      liveUnrealizedPnl,
      livePnlPct,
      marginNotional,
    };
  });
};

export const resolveUnrealized = (snapshot: RuntimeSnapshot | null) => {
  if (!snapshot) return 0;
  const liveOpen = buildLiveOpenPositions(snapshot.positions, snapshot.symbolStats, new Map<string, number>());
  if (liveOpen.length > 0) {
    return liveOpen.reduce((sum, row) => sum + row.liveUnrealizedPnl, 0);
  }
  if (typeof snapshot.symbolStats?.summary.unrealizedPnl === 'number') {
    return snapshot.symbolStats.summary.unrealizedPnl;
  }
  return snapshot.positions?.summary.unrealizedPnl ?? 0;
};

export const maxDrawdown = (trades: BotRuntimeTrade[]) => {
  if (trades.length === 0) return { abs: 0, pct: null as number | null };
  const sorted = [...trades].sort((left, right) => toTimestamp(left.executedAt) - toTimestamp(right.executedAt));
  let running = 0;
  let peak = 0;
  let drawdown = 0;
  for (const trade of sorted) {
    running += trade.realizedPnl;
    peak = Math.max(peak, running);
    drawdown = Math.min(drawdown, running - peak);
  }
  const abs = Math.abs(drawdown);
  return { abs, pct: peak > 0 ? (abs / peak) * 100 : null };
};
