export const dashboardReportsPl = {
  page: {
    title: "Raporty",
    breadcrumbPerformance: "Wydajnosc",
  },
  states: {
    loadingTitle: "Ladowanie raportow wydajnosci",
    errorTitle: "Nie udalo sie pobrac raportow wydajnosci",
    errorFallback: "Nie udalo sie pobrac raportow wydajnosci.",
    retryLabel: "Sprobuj ponownie",
    emptyTitle: "Brak raportow wydajnosci",
    emptyDescription: "Gdy pojawia sie zakonczone backtesty z raportem, zobaczysz je tutaj.",
    successTitle: "Raporty wydajnosci wczytane",
    successDescription: "Wczytano {count} raportow do analizy wydajnosci.",
  },
  cards: {
    reports: "Raporty",
    avgNetPnl: "Sredni Net PnL",
    avgWinRate: "Sredni Win Rate",
    bestRun: "Najlepszy run",
  },
  sections: {
    crossMode: {
      title: "Wydajnosc miedzy trybami",
      description: "Porownanie skutecznosci BACKTEST vs PAPER vs LIVE.",
      table: {
        mode: "Tryb",
        trades: "Transakcje",
        winRate: "Win Rate",
        netPnl: "Net PnL",
        grossProfit: "Zysk brutto",
        grossLoss: "Strata brutto",
      },
    },
    byRun: {
      title: "Wydajnosc wedlug runu backtestu",
      table: {
        run: "Run",
        symbol: "Symbol",
        timeframe: "Interwal",
        trades: "Transakcje",
        winRate: "Win Rate",
        netPnl: "Net PnL",
        maxDd: "Max DD",
        sharpe: "Sharpe",
      },
    },
  },
} as const;
