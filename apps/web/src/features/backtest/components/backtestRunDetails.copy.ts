export type BacktestRunDetailsCopy = {
  loadingTitle: string;
  loadErrorTitle: string;
  loadErrorDefault: string;
  retry: string;
  notFoundTitle: string;
  notFoundDescription: string;
  statusInProgress: string;
  runPreview: string;
  marketGroup: string;
  strategy: string;
  calcStart: string;
  calcEnd: string;
  progressTitle: string;
  stageRunCreated: string;
  stageEngineRunning: string;
  stageTradesReady: string;
  stageReportReady: string;
  stageRunFinished: string;
  trades: string;
  netPnl: string;
  winRate: string;
  maxDrawdown: string;
  stagesTitle: string;
  tabSummary: string;
  tabMarkets: string;
  tabTrades: string;
  tabRaw: string;
  reportNotReadyTitle: string;
  reportNotReadyDescription: string;
  summaryNetPnl: string;
  summaryWinRate: string;
  summaryTrades: string;
  summaryMaxDrawdown: string;
  summaryStartBalance: string;
  summaryEndBalance: string;
  summaryDailyPnlTitle: string;
  summaryBalanceTitle: string;
  summaryDailyPnlNoData: string;
  summaryBalanceNoData: string;
  marketsEmptyTitle: string;
  marketsEmptyDescription: string;
  globalLegendTitle: string;
  legendEntryLong: string;
  legendEntryShort: string;
  legendExitProfit: string;
  legendExitLoss: string;
  legendDca: string;
  timelineLoading: string;
  timelineLoadingPhaseEvents: string;
  timelineLoadingPhaseCandles: string;
  timelineLoadingPrefix: string;
  timelineNoCandles: string;
  timelineLoadErrorDefault: string;
  timelineParityFailedDefault: string;
  zoom: string;
  pairStatsTitle: string;
  parityFailed: string;
  runTotalValue: string;
  chartWindowValue: string;
  avgHold: string;
  pnl: string;
  dca: string;
  executionTitle: string;
  avgEntry: string;
  avgExit: string;
  closedOnLastCandle: string;
  liquidations: string;
  dataRangeTitle: string;
  tradesRange: string;
  candlesRange: string;
  chartMinMax: string;
  indicatorsTitle: string;
  noIndicators: string;
  noTradesTitle: string;
  noTradesDescription: string;
  totalProfit: string;
  totalLoss: string;
  extremes: string;
  biggestWin: string;
  biggestLoss: string;
  colSymbol: string;
  colSide: string;
  colOpen: string;
  colClose: string;
  colDuration: string;
  colQty: string;
  colDca: string;
  colEntry: string;
  colExit: string;
  colNotionalEntry: string;
  colNotionalExit: string;
  colMarginEntry: string;
  colMarginExit: string;
  colMoveSide: string;
  colPnlNotional: string;
  colPnlMargin: string;
  colFee: string;
  colExitReason: string;
  colPnl: string;
  colCumPnl: string;
  dash: string;
  custom: string;
};

const EN_COPY: BacktestRunDetailsCopy = {
  loadingTitle: 'Loading backtest details',
  loadErrorTitle: 'Failed to load backtest details',
  loadErrorDefault: 'Could not fetch backtest details.',
  retry: 'Try again',
  notFoundTitle: 'Run not found',
  notFoundDescription: 'Selected run does not exist or you do not have access.',
  statusInProgress: 'in progress',
  runPreview: 'Backtest run preview',
  marketGroup: 'Market group:',
  strategy: 'Strategy:',
  calcStart: 'Calculation start:',
  calcEnd: 'Calculation end:',
  progressTitle: 'Run progress',
  stageRunCreated: 'Run created',
  stageEngineRunning: 'Engine is calculating',
  stageTradesReady: 'Trades ready',
  stageReportReady: 'Report and chart',
  stageRunFinished: 'Backtest finished',
  trades: 'Trades',
  netPnl: 'Net PnL',
  winRate: 'Win rate',
  maxDrawdown: 'Max drawdown',
  stagesTitle: 'Stages:',
  tabSummary: 'Summary',
  tabMarkets: 'Markets',
  tabTrades: 'Trades',
  tabRaw: 'Raw',
  reportNotReadyTitle: 'Report is not ready yet',
  reportNotReadyDescription: 'After run completion the report will appear automatically.',
  summaryNetPnl: 'Net PnL',
  summaryWinRate: 'Win Rate',
  summaryTrades: 'Trades',
  summaryMaxDrawdown: 'Max Drawdown',
  summaryStartBalance: 'Start Balance',
  summaryEndBalance: 'End Balance',
  summaryDailyPnlTitle: 'Daily PnL',
  summaryBalanceTitle: 'Portfolio balance from start to end',
  summaryDailyPnlNoData: 'No daily data to draw the chart.',
  summaryBalanceNoData: 'No balance data to draw the chart.',
  marketsEmptyTitle: 'No market data',
  marketsEmptyDescription: 'Per-market results appear after at least one trade.',
  globalLegendTitle: 'Global chart legend',
  legendEntryLong: 'Entry LONG',
  legendEntryShort: 'Entry SHORT',
  legendExitProfit: 'Exit profit',
  legendExitLoss: 'Exit loss',
  legendDca: 'DCA',
  timelineLoading: 'Loading timeline...',
  timelineLoadingPhaseEvents: 'position markers',
  timelineLoadingPhaseCandles: 'candles and indicators',
  timelineLoadingPrefix: 'Loading more',
  timelineNoCandles: 'No candles for selected range.',
  timelineLoadErrorDefault: 'Failed to load market timeline.',
  timelineParityFailedDefault: 'Symbol processing failed during backtest run.',
  zoom: 'Zoom',
  pairStatsTitle: 'Pair stats',
  parityFailed: 'Parity FAILED',
  runTotalValue: 'Run total',
  chartWindowValue: 'Chart window',
  avgHold: 'Avg hold',
  pnl: 'PnL',
  dca: 'DCA',
  executionTitle: 'Execution',
  avgEntry: 'Average entry',
  avgExit: 'Average exit',
  closedOnLastCandle: 'Closed on last candle',
  liquidations: 'Liquidations',
  dataRangeTitle: 'Data range',
  tradesRange: 'Trades range:',
  candlesRange: 'Candles range:',
  chartMinMax: 'Chart min/max:',
  indicatorsTitle: 'Strategy indicators',
  noIndicators: 'No indicator metadata in strategy config.',
  noTradesTitle: 'No trades',
  noTradesDescription: 'There are no trades for this run.',
  totalProfit: 'Gross profit',
  totalLoss: 'Gross loss',
  extremes: 'Extremes',
  biggestWin: 'Largest win',
  biggestLoss: 'Largest loss',
  colSymbol: 'Symbol',
  colSide: 'Side',
  colOpen: 'Open',
  colClose: 'Close',
  colDuration: 'Duration',
  colQty: 'Qty',
  colDca: 'DCA',
  colEntry: 'Entry',
  colExit: 'Exit',
  colNotionalEntry: 'Entry notional',
  colNotionalExit: 'Exit notional',
  colMarginEntry: 'Entry margin',
  colMarginExit: 'Exit margin',
  colMoveSide: 'Move % (side)',
  colPnlNotional: 'PnL % (notional)',
  colPnlMargin: 'PnL % (margin)',
  colFee: 'Fee',
  colExitReason: 'Exit reason',
  colPnl: 'PnL',
  colCumPnl: 'Cumulative PnL',
  dash: '-',
  custom: 'Custom',
};

const PL_COPY: BacktestRunDetailsCopy = {
  loadingTitle: 'Ladowanie szczegolow backtestu',
  loadErrorTitle: 'Nie udalo sie pobrac szczegolow backtestu',
  loadErrorDefault: 'Nie udalo sie pobrac danych backtestu.',
  retry: 'Sprobuj ponownie',
  notFoundTitle: 'Nie znaleziono runa',
  notFoundDescription: 'Wybrany run nie istnieje albo nie masz do niego dostepu.',
  statusInProgress: 'w toku',
  runPreview: 'Podglad uruchomienia backtestu',
  marketGroup: 'Grupa rynkow:',
  strategy: 'Strategia:',
  calcStart: 'Start obliczen:',
  calcEnd: 'Koniec obliczen:',
  progressTitle: 'Postep runa',
  stageRunCreated: 'Run utworzony',
  stageEngineRunning: 'Silnik liczy wynik',
  stageTradesReady: 'Lista transakcji gotowa',
  stageReportReady: 'Raport i wykres',
  stageRunFinished: 'Backtest zakonczony',
  trades: 'Transakcje',
  netPnl: 'Net PnL',
  winRate: 'Skutecznosc',
  maxDrawdown: 'Maks. drawdown',
  stagesTitle: 'Etapy:',
  tabSummary: 'Podsumowanie',
  tabMarkets: 'Rynki',
  tabTrades: 'Transakcje',
  tabRaw: 'Raw',
  reportNotReadyTitle: 'Raport nie jest jeszcze gotowy',
  reportNotReadyDescription: 'Po zakonczeniu runa raport pojawi sie automatycznie.',
  summaryNetPnl: 'Net PnL',
  summaryWinRate: 'Skutecznosc',
  summaryTrades: 'Transakcje',
  summaryMaxDrawdown: 'Maks. drawdown',
  summaryStartBalance: 'Saldo startowe',
  summaryEndBalance: 'Saldo koncowe',
  summaryDailyPnlTitle: 'Dzienny wynik (zysk/strata)',
  summaryBalanceTitle: 'Saldo portfela od startu do konca',
  summaryDailyPnlNoData: 'Brak danych dziennych do narysowania wykresu.',
  summaryBalanceNoData: 'Brak danych salda do narysowania wykresu.',
  marketsEmptyTitle: 'Brak danych per rynek',
  marketsEmptyDescription: 'Wyniki per para pojawia sie po wygenerowaniu przynajmniej jednej transakcji.',
  globalLegendTitle: 'Legenda globalna wykresow',
  legendEntryLong: 'Wejscie LONG',
  legendEntryShort: 'Wejscie SHORT',
  legendExitProfit: 'Wyjscie zysk',
  legendExitLoss: 'Wyjscie strata',
  legendDca: 'DCA',
  timelineLoading: 'Ladowanie timeline...',
  timelineLoadingPhaseEvents: 'znacznikow pozycji',
  timelineLoadingPhaseCandles: 'swiec i wskaznikow',
  timelineLoadingPrefix: 'Doladowywanie',
  timelineNoCandles: 'Brak swiec dla wybranego zakresu.',
  timelineLoadErrorDefault: 'Nie udalo sie pobrac timeline dla rynku.',
  timelineParityFailedDefault: 'Przetwarzanie symbolu nie powiodlo sie podczas backtestu.',
  zoom: 'Zoom',
  pairStatsTitle: 'Statystyki pary',
  parityFailed: 'Przetwarzanie pary nie powiodlo sie',
  runTotalValue: 'Caly run',
  chartWindowValue: 'Zakres wykresu',
  avgHold: 'Sredni hold',
  pnl: 'PnL',
  dca: 'DCA',
  executionTitle: 'Egzekucja',
  avgEntry: 'Srednie wejscie',
  avgExit: 'Srednie wyjscie',
  closedOnLastCandle: 'Zamkniete na ostatniej swiecy',
  liquidations: 'Likwidacje',
  dataRangeTitle: 'Zakres danych',
  tradesRange: 'Zakres transakcji:',
  candlesRange: 'Zakres swiec:',
  chartMinMax: 'Cena min/max (wykres):',
  indicatorsTitle: 'Wskazniki strategii',
  noIndicators: 'Brak danych o wskaznikach w konfiguracji strategii.',
  noTradesTitle: 'Brak transakcji',
  noTradesDescription: 'Dla tego runa nie ma jeszcze transakcji.',
  totalProfit: 'Suma zyskow',
  totalLoss: 'Suma strat',
  extremes: 'Ekstrema',
  biggestWin: 'Najwiekszy zysk',
  biggestLoss: 'Najwieksza strata',
  colSymbol: 'Symbol',
  colSide: 'Strona',
  colOpen: 'Otwarcie',
  colClose: 'Zamkniecie',
  colDuration: 'Czas',
  colQty: 'Ilosc',
  colDca: 'DCA',
  colEntry: 'Wejscie',
  colExit: 'Wyjscie',
  colNotionalEntry: 'Notional wej.',
  colNotionalExit: 'Notional wyj.',
  colMarginEntry: 'Margin wej.',
  colMarginExit: 'Margin wyj.',
  colMoveSide: 'Ruch % (side)',
  colPnlNotional: 'PnL % (notional)',
  colPnlMargin: 'PnL % (margin)',
  colFee: 'Prowizja',
  colExitReason: 'Powod wyjscia',
  colPnl: 'PnL',
  colCumPnl: 'Skumulowany PnL',
  dash: '-',
  custom: 'Niestandardowa',
};

const PT_COPY: BacktestRunDetailsCopy = {
  ...EN_COPY,
  loadingTitle: 'A carregar detalhes do backtest',
  loadErrorTitle: 'Nao foi possivel carregar detalhes do backtest',
  loadErrorDefault: 'Nao foi possivel obter detalhes do backtest.',
  retry: 'Tentar novamente',
  notFoundTitle: 'Execucao nao encontrada',
  notFoundDescription: 'A execucao selecionada nao existe ou nao tens acesso.',
  summaryDailyPnlTitle: 'PnL diario',
  summaryBalanceTitle: 'Saldo da carteira do inicio ao fim',
  marketsEmptyTitle: 'Sem dados de mercado',
  marketsEmptyDescription: 'Resultados por mercado aparecem apos pelo menos uma trade.',
  tabSummary: 'Resumo',
  tabMarkets: 'Mercados',
  tabTrades: 'Trades',
  runTotalValue: 'Total da execucao',
  noTradesTitle: 'Sem trades',
  noTradesDescription: 'Nao existem trades para esta execucao.',
};

export const getBacktestRunDetailsCopy = (locale: 'en' | 'pl' | 'pt'): BacktestRunDetailsCopy =>
  locale === 'en' ? EN_COPY : locale === 'pt' ? PT_COPY : PL_COPY;
