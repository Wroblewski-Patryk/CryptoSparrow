import { BacktestTrade } from '../types/backtest.type';

export type BacktestSymbolPricePoint = {
  id: string;
  kind: 'entry' | 'exit';
  side: 'LONG' | 'SHORT';
  timestamp: number;
  price: number;
  pnl?: number;
};

export type BacktestSymbolStats = {
  symbol: string;
  tradesCount: number;
  wins: number;
  losses: number;
  winRate: number | null;
  netPnl: number;
  avgEntry: number;
  avgExit: number;
  avgHoldMinutes: number;
  points: BacktestSymbolPricePoint[];
  firstAt: number | null;
  lastAt: number | null;
};

export const safeTradeDateMs = (value: string) => {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
};

export const groupBacktestTradesBySymbol = (items: BacktestTrade[]) => {
  const grouped = new Map<string, BacktestTrade[]>();
  for (const trade of items) {
    const bucket = grouped.get(trade.symbol) ?? [];
    bucket.push(trade);
    grouped.set(trade.symbol, bucket);
  }

  for (const [symbol, symbolTrades] of grouped.entries()) {
    grouped.set(
      symbol,
      [...symbolTrades].sort((a, b) => safeTradeDateMs(a.openedAt) - safeTradeDateMs(b.openedAt)),
    );
  }

  return grouped;
};

export const buildBacktestSymbolStats = (
  items: BacktestTrade[],
  configuredSymbols: string[] = [],
): BacktestSymbolStats[] => {
  const grouped = groupBacktestTradesBySymbol(items);
  const stats = [...grouped.entries()].map(([symbol, trades]) => {
    const wins = trades.filter((trade) => trade.pnl > 0).length;
    const losses = trades.filter((trade) => trade.pnl < 0).length;
    const netPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);
    const avgEntry = trades.reduce((sum, trade) => sum + trade.entryPrice, 0) / trades.length;
    const avgExit = trades.reduce((sum, trade) => sum + trade.exitPrice, 0) / trades.length;
    const avgHoldMinutes =
      trades.reduce((sum, trade) => sum + Math.max(0, safeTradeDateMs(trade.closedAt) - safeTradeDateMs(trade.openedAt)), 0) /
      trades.length /
      60_000;

    const points = trades.flatMap((trade) => {
      const openedAt = safeTradeDateMs(trade.openedAt);
      const closedAt = safeTradeDateMs(trade.closedAt);
      return [
        {
          id: `${trade.id}-entry`,
          kind: 'entry' as const,
          side: trade.side,
          timestamp: openedAt,
          price: trade.entryPrice,
        },
        {
          id: `${trade.id}-exit`,
          kind: 'exit' as const,
          side: trade.side,
          timestamp: closedAt,
          price: trade.exitPrice,
          pnl: trade.pnl,
        },
      ];
    });

    return {
      symbol,
      tradesCount: trades.length,
      wins,
      losses,
      winRate: trades.length > 0 ? (wins / trades.length) * 100 : null,
      netPnl,
      avgEntry,
      avgExit,
      avgHoldMinutes,
      points: points.sort((a, b) => a.timestamp - b.timestamp),
      firstAt: trades[0] ? safeTradeDateMs(trades[0].openedAt) : null,
      lastAt: trades[trades.length - 1] ? safeTradeDateMs(trades[trades.length - 1].closedAt) : null,
    } satisfies BacktestSymbolStats;
  });

  const withMissing = [...stats];
  for (const symbol of configuredSymbols) {
    if (withMissing.some((item) => item.symbol === symbol)) continue;
    withMissing.push({
      symbol,
      tradesCount: 0,
      wins: 0,
      losses: 0,
      winRate: null,
      netPnl: 0,
      avgEntry: 0,
      avgExit: 0,
      avgHoldMinutes: 0,
      points: [],
      firstAt: null,
      lastAt: null,
    });
  }

  return withMissing.sort((a, b) => a.symbol.localeCompare(b.symbol));
};

