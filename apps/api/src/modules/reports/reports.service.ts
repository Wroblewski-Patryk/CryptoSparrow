import { prisma } from '../../prisma/client';

export type PerformanceMode = 'BACKTEST' | 'PAPER' | 'LIVE';

export type ModePerformance = {
  mode: PerformanceMode;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number | null;
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
};

type BacktestReportRow = {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  netPnl: number | null;
  grossProfit: number | null;
  grossLoss: number | null;
};

type TradeRow = {
  realizedPnl: number | null;
};

const toNumber = (value: number | null | undefined) => (typeof value === 'number' ? value : 0);

export const aggregateModePerformance = (
  mode: PerformanceMode,
  input: {
    backtestReports?: BacktestReportRow[];
    trades?: TradeRow[];
  }
): ModePerformance => {
  if (mode === 'BACKTEST') {
    const reports = input.backtestReports ?? [];
    const totalTrades = reports.reduce((acc, item) => acc + item.totalTrades, 0);
    const winningTrades = reports.reduce((acc, item) => acc + item.winningTrades, 0);
    const losingTrades = reports.reduce((acc, item) => acc + item.losingTrades, 0);
    const netPnl = reports.reduce((acc, item) => acc + toNumber(item.netPnl), 0);
    const grossProfit = reports.reduce((acc, item) => acc + toNumber(item.grossProfit), 0);
    const grossLoss = reports.reduce((acc, item) => acc + Math.abs(toNumber(item.grossLoss)), 0);

    return {
      mode,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : null,
      netPnl,
      grossProfit,
      grossLoss,
    };
  }

  const trades = input.trades ?? [];
  const totalTrades = trades.length;
  let winningTrades = 0;
  let losingTrades = 0;
  let netPnl = 0;
  let grossProfit = 0;
  let grossLoss = 0;

  for (const trade of trades) {
    const pnl = toNumber(trade.realizedPnl);
    netPnl += pnl;
    if (pnl > 0) {
      winningTrades += 1;
      grossProfit += pnl;
    } else if (pnl < 0) {
      losingTrades += 1;
      grossLoss += Math.abs(pnl);
    }
  }

  return {
    mode,
    totalTrades,
    winningTrades,
    losingTrades,
    winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : null,
    netPnl,
    grossProfit,
    grossLoss,
  };
};

export const getCrossModePerformance = async (userId: string) => {
  const [backtestReports, paperTrades, liveTrades] = await Promise.all([
    prisma.backtestReport.findMany({
      where: { userId },
      select: {
        totalTrades: true,
        winningTrades: true,
        losingTrades: true,
        netPnl: true,
        grossProfit: true,
        grossLoss: true,
      },
      take: 400,
    }),
    prisma.trade.findMany({
      where: {
        userId,
        botId: { not: null },
        bot: { mode: 'PAPER' },
      },
      select: { realizedPnl: true },
      take: 2000,
    }),
    prisma.trade.findMany({
      where: {
        userId,
        botId: { not: null },
        bot: { mode: 'LIVE' },
      },
      select: { realizedPnl: true },
      take: 2000,
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    modeResolution: 'BOT_CURRENT_MODE',
    rows: [
      aggregateModePerformance('BACKTEST', { backtestReports }),
      aggregateModePerformance('PAPER', { trades: paperTrades }),
      aggregateModePerformance('LIVE', { trades: liveTrades }),
    ],
  };
};

