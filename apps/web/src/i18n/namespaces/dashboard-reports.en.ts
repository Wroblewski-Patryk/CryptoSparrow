export const dashboardReportsEn = {
  page: {
    title: "Reports",
    breadcrumbPerformance: "Performance",
  },
  states: {
    loadingTitle: "Loading performance reports",
    errorTitle: "Could not load performance reports",
    errorFallback: "Could not load performance reports.",
    retryLabel: "Try again",
    emptyTitle: "No performance reports yet",
    emptyDescription: "Completed backtests with reports will appear here.",
    successTitle: "Performance reports loaded",
    successDescription: "Loaded {count} reports for performance analysis.",
  },
  cards: {
    reports: "Reports",
    avgNetPnl: "Avg Net PnL",
    avgWinRate: "Avg Win Rate",
    bestRun: "Best Run",
  },
  sections: {
    crossMode: {
      title: "Cross-mode performance",
      description: "Compare BACKTEST vs PAPER vs LIVE effectiveness.",
      table: {
        mode: "Mode",
        trades: "Trades",
        winRate: "Win Rate",
        netPnl: "Net PnL",
        grossProfit: "Gross Profit",
        grossLoss: "Gross Loss",
      },
    },
    byRun: {
      title: "Performance by backtest run",
      table: {
        run: "Run",
        symbol: "Symbol",
        timeframe: "Timeframe",
        trades: "Trades",
        winRate: "Win Rate",
        netPnl: "Net PnL",
        maxDd: "Max DD",
        sharpe: "Sharpe",
      },
    },
  },
} as const;
