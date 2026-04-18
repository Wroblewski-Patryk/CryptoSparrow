export const dashboardReportsPt = {
  page: {
    title: "Relatorios",
    breadcrumbPerformance: "Performance",
  },
  states: {
    loadingTitle: "A carregar relatorios de performance",
    errorTitle: "Nao foi possivel carregar os relatorios de performance",
    errorFallback: "Nao foi possivel carregar os relatorios de performance.",
    retryLabel: "Tentar novamente",
    emptyTitle: "Sem relatorios de performance",
    emptyDescription: "Backtests concluidos com relatorio aparecerao aqui.",
    successTitle: "Relatorios de performance carregados",
    successDescription: "Foram carregados {count} relatorios para analise de performance.",
  },
  cards: {
    reports: "Relatorios",
    avgNetPnl: "PnL liquido medio",
    avgWinRate: "Taxa media de acerto",
    bestRun: "Melhor execucao",
  },
  sections: {
    crossMode: {
      title: "Performance entre modos",
      description: "Comparacao de eficacia BACKTEST vs PAPER vs LIVE.",
      table: {
        mode: "Modo",
        trades: "Transacoes",
        winRate: "Taxa de acerto",
        netPnl: "PnL liquido",
        grossProfit: "Lucro bruto",
        grossLoss: "Perda bruta",
      },
    },
    byRun: {
      title: "Performance por execucao de backtest",
      table: {
        run: "Execucao",
        symbol: "Simbolo",
        timeframe: "Intervalo",
        trades: "Transacoes",
        winRate: "Taxa de acerto",
        netPnl: "PnL liquido",
        maxDd: "Max DD",
        sharpe: "Sharpe",
      },
    },
  },
} as const;
