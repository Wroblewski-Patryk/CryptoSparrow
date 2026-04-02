export type Locale = "en" | "pl";

type TranslationSchema = {
  dashboard: {
    nav: {
      markets: string;
      builder: string;
      strategies: string;
      backtest: string;
      reports: string;
      logs: string;
      exchanges: string;
      orders: string;
      positions: string;
      bots: string;
    };
    common: {
      dashboard: string;
      add: string;
      language: string;
      english: string;
      polish: string;
    };
    footer: {
      rights: string;
    };
    logs: {
      title: string;
      breadcrumbLogs: string;
      loading: string;
      loadErrorTitle: string;
      loadErrorDescription: string;
      retry: string;
      emptyTitle: string;
      emptyDescription: string;
      loadedTitle: string;
      loadedDescription: string;
      sourceFilterLabel: string;
      severityFilterLabel: string;
      sourceAll: string;
      severityAll: string;
      refresh: string;
      tableTime: string;
      tableSource: string;
      tableSeverity: string;
      tableAction: string;
      tableActor: string;
      tableDetails: string;
      tableTrace: string;
      actorFallback: string;
      traceButton: string;
      traceTitle: string;
      traceDescription: string;
      traceNoMetadata: string;
    };
    liveMarket: {
      title: string;
      streamDisconnected: string;
      streamConnected: string;
      streamConnectedLag: string;
      noCandle: string;
      candleFresh: string;
      candleAgoSeconds: string;
      candleAgoMinutes: string;
      delta24hLabel: string;
      valueUnknown: string;
    };
    home: {
      loadWidgets: string;
      loadWidgetsErrorTitle: string;
      loadWidgetsErrorDescription: string;
      noTradingDataTitle: string;
      noTradingDataDescription: string;
      openPositions: string;
      openOrders: string;
      filledOrders: string;
      rejectedOrders: string;
      positionsSnapshot: string;
      noOpenPositionsTitle: string;
      noOpenPositionsDescription: string;
      positionsAction: string;
      controlCenterTitle: string;
      controlCenterDescription: string;
      controlCenterBadge: string;
      runtimeOpsTitle: string;
      runtimeOpsDescription: string;
      runtimeOpsMeta: string;
      runtimeOpsAction: string;
      runtimeOpsActionShort: string;
      strategyLabTitle: string;
      strategyLabDescription: string;
      strategyLabPrimaryAction: string;
      strategyLabSecondaryAction: string;
      executionReviewTitle: string;
      executionReviewDescription: string;
      executionReviewPrimaryAction: string;
      executionReviewSecondaryAction: string;
      laneStepOne: string;
      laneStepTwo: string;
      laneStepThree: string;
      quickActionsStripTitle: string;
      quickActionsStripDescription: string;
      quickActionsPrimaryLabel: string;
      quickActionsSecondaryLabel: string;
      quickActionStrategies: string;
      quickActionBacktests: string;
      quickActionOrders: string;
      quickActionReports: string;
      handoffCuesTitle: string;
      handoffRuntimeCue: string;
      handoffBacktestCue: string;
      handoffReportsCue: string;
      statusRuntimeNowLabel: string;
      statusRuntimeNowValue: string;
      statusExecutionQualityLabel: string;
      statusExecutionQualityValue: string;
      statusActivityLabel: string;
      statusActivityValue: string;
      statusRiskWatchLabel: string;
      statusRiskWatchValue: string;
      statusLatestEventLabel: string;
      statusLatestEventValue: string;
      statusNoActivityValue: string;
      quickActions: string;
      reviewStrategies: string;
      openOrdersAction: string;
      runBacktest: string;
      ordersSnapshot: string;
      pending: string;
      recentActivity: string;
      noActivityTitle: string;
      noActivityDescription: string;
      activityTableTime: string;
      activityTableEvent: string;
      liveSnapshotSyncedTitle: string;
      liveSnapshotSyncedDescription: string;
      activityPositionOpened: string;
      activityOrder: string;
      side: string;
      quantity: string;
      leverage: string;
      unrealizedPnl: string;
      pageTitle: string;
      pageBreadcrumb: string;
      runtime: {
        loadingTitle: string;
        errorTitle: string;
        errorRetry: string;
        noBotsTitle: string;
        noBotsDescription: string;
        addBot: string;
        goToStrategies: string;
        noActiveBotsTitle: string;
        noActiveBotsDescription: string;
        goToBots: string;
        openPositionsTitle: string;
        timeOpened: string;
        symbol: string;
        side: string;
        margin: string;
        pnl: string;
        pnlPercent: string;
        dca: string;
        slTtp: string;
        slTsl: string;
        noOpenPositions: string;
        tradesHistoryTitlePaper: string;
        tradesHistoryTitleLive: string;
        filterSymbol: string;
        filterSide: string;
        filterAction: string;
        filterFrom: string;
        filterTo: string;
        apply: string;
        reset: string;
        all: string;
        actionOpen: string;
        actionDca: string;
        actionClose: string;
        time: string;
        qty: string;
        price: string;
        fee: string;
        realizedPnl: string;
        origin: string;
        noTradeHistory: string;
        recordsBadge: string;
        pageBadge: string;
        rows: string;
        previous: string;
        next: string;
        liveChecksTitle: string;
        pairsCount: string;
        noSignalConditions: string;
        noSignalData: string;
        long: string;
        short: string;
        runtimeRiskTitle: string;
        selectedBot: string;
        status: string;
        mode: string;
        heartbeat: string;
        openPositions: string;
        signalsDca: string;
        netPnl: string;
        noSession: string;
        noActiveSessionWarning: string;
        capitalRiskTitle: string;
        portfolio: string;
        deltaFromStart: string;
        freeFunds: string;
        fundsInPositions: string;
        exposure: string;
        realizedOpen: string;
        winRate: string;
        maxDrawdown: string;
        updatedAt: string;
      };
    };
  };
};

export const translations: Record<Locale, TranslationSchema> = {
  en: {
    dashboard: {
      nav: {
        markets: "Markets",
        builder: "Builder",
        strategies: "Strategies",
        backtest: "Backtest",
        reports: "Reports",
        logs: "Logs",
        exchanges: "Exchanges",
        orders: "Orders",
        positions: "Positions",
        bots: "Bots",
      },
      common: {
        dashboard: "Dashboard",
        add: "Add",
        language: "Language",
        english: "English",
        polish: "Polish",
      },
      footer: {
        rights: "All rights reserved.",
      },
      logs: {
        title: "Audit Trail",
        breadcrumbLogs: "Logs",
        loading: "Loading audit trail",
        loadErrorTitle: "Failed to load audit trail",
        loadErrorDescription: "Could not fetch audit logs.",
        retry: "Try again",
        emptyTitle: "No audit trail events",
        emptyDescription: "No log entries for selected filters.",
        loadedTitle: "Audit trail loaded",
        loadedDescription: "Loaded {count} events.",
        sourceFilterLabel: "Source filter",
        severityFilterLabel: "Severity filter",
        sourceAll: "All sources",
        severityAll: "All severity",
        refresh: "Refresh",
        tableTime: "Time",
        tableSource: "Source",
        tableSeverity: "Severity",
        tableAction: "Action",
        tableActor: "Actor",
        tableDetails: "Details",
        tableTrace: "Trace",
        actorFallback: "-",
        traceButton: "View trace",
        traceTitle: "Decision trace",
        traceDescription: "Selected event metadata and decision context.",
        traceNoMetadata: "No metadata available for this event.",
      },
      liveMarket: {
        title: "Live Market Bar",
        streamDisconnected: "stream disconnected",
        streamConnected: "stream connected",
        streamConnectedLag: "stream connected ({lag}ms lag)",
        noCandle: "no candle",
        candleFresh: "fresh",
        candleAgoSeconds: "{seconds}s ago",
        candleAgoMinutes: "{minutes}m ago",
        delta24hLabel: "24h",
        valueUnknown: "--",
      },
      home: {
        loadWidgets: "Loading live snapshot widgets",
        loadWidgetsErrorTitle: "Could not load dashboard widgets",
        loadWidgetsErrorDescription: "Could not fetch dashboard widgets.",
        noTradingDataTitle: "No trading data",
        noTradingDataDescription: "When orders or positions appear, live snapshot and activity feed will be visible here.",
        openPositions: "Open Positions",
        openOrders: "Open Orders",
        filledOrders: "Filled Orders",
        rejectedOrders: "Rejected Orders",
        positionsSnapshot: "Positions Snapshot",
        noOpenPositionsTitle: "No open positions",
        noOpenPositionsDescription: "There are no active positions at the moment.",
        positionsAction: "Open Positions",
        controlCenterTitle: "Control center lanes",
        controlCenterDescription: "Use this section to pick your next operational step without jumping between modules.",
        controlCenterBadge: "Global dashboard",
        runtimeOpsTitle: "Bots runtime operations",
        runtimeOpsDescription: "Monitor open positions, history, and live signal checks in one operational module.",
        runtimeOpsMeta: "Open positions: {positions} | Open orders: {orders}",
        runtimeOpsAction: "Open Bots Operations Center",
        runtimeOpsActionShort: "Bots Runtime",
        strategyLabTitle: "Strategy and backtest lane",
        strategyLabDescription: "Prepare and validate ideas before enabling runtime execution.",
        strategyLabPrimaryAction: "Strategies",
        strategyLabSecondaryAction: "Backtests",
        executionReviewTitle: "Execution review lane",
        executionReviewDescription: "Review execution outcomes, pending items, and current exposure.",
        executionReviewPrimaryAction: "Orders",
        executionReviewSecondaryAction: "Positions",
        laneStepOne: "Step 1",
        laneStepTwo: "Step 2",
        laneStepThree: "Step 3",
        quickActionsStripTitle: "Quick actions",
        quickActionsStripDescription: "Pick one action and move on.",
        quickActionsPrimaryLabel: "Primary path",
        quickActionsSecondaryLabel: "Secondary paths",
        quickActionStrategies: "Review strategies",
        quickActionBacktests: "Run backtests",
        quickActionOrders: "Check orders",
        quickActionReports: "Open reports",
        handoffCuesTitle: "Module handoff cues",
        handoffRuntimeCue: "Live runtime -> Bots",
        handoffBacktestCue: "Validation -> Backtests",
        handoffReportsCue: "Performance review -> Reports",
        statusRuntimeNowLabel: "Runtime now",
        statusRuntimeNowValue: "{positions} positions | {orders} orders",
        statusExecutionQualityLabel: "Execution quality",
        statusExecutionQualityValue: "{filled} filled | {rejected} rejected",
        statusActivityLabel: "Recent activity",
        statusActivityValue: "{count} recent events",
        statusRiskWatchLabel: "Risk watch",
        statusRiskWatchValue: "{pending} pending | {rejected} rejected",
        statusLatestEventLabel: "Latest event",
        statusLatestEventValue: "At {time}",
        statusNoActivityValue: "No recent events",
        quickActions: "Quick Actions",
        reviewStrategies: "Review Strategies",
        openOrdersAction: "Open Orders",
        runBacktest: "Run Backtest",
        ordersSnapshot: "Orders Snapshot",
        pending: "Pending",
        recentActivity: "Recent Activity",
        noActivityTitle: "No activity",
        noActivityDescription: "Feed will appear after first orders/positions.",
        activityTableTime: "Time",
        activityTableEvent: "Event",
        liveSnapshotSyncedTitle: "Live snapshot synced",
        liveSnapshotSyncedDescription: "Open positions: {positions}, open orders: {orders}.",
        activityPositionOpened: "{side} {symbol} opened (x{leverage}).",
        activityOrder: "{type} {symbol} {side} ({status}).",
        side: "Side",
        quantity: "Qty",
        leverage: "Leverage",
        unrealizedPnl: "Unrealized PnL",
        pageTitle: "Control Center",
        pageBreadcrumb: "Control Center",
        runtime: {
          loadingTitle: "Loading operational dashboard",
          errorTitle: "Could not load operational dashboard",
          errorRetry: "Try again",
          noBotsTitle: "No bots available for dashboard summary",
          noBotsDescription: "Add your first bot to start the operations center.",
          addBot: "Add bot",
          goToStrategies: "Go to strategies",
          noActiveBotsTitle: "No active bots on dashboard",
          noActiveBotsDescription: "Activate at least one bot to see live runtime.",
          goToBots: "Go to bots",
          openPositionsTitle: "Open positions",
          timeOpened: "Time opened",
          symbol: "Symbol",
          side: "Side",
          margin: "Margin",
          pnl: "PnL",
          pnlPercent: "PnL %",
          dca: "DCA",
          slTtp: "SL (TTP)",
          slTsl: "SL (TSL)",
          noOpenPositions: "No open positions.",
          tradesHistoryTitlePaper: "Trade history",
          tradesHistoryTitleLive: "Orders and trade history",
          filterSymbol: "Symbol",
          filterSide: "Side",
          filterAction: "Action",
          filterFrom: "From",
          filterTo: "To",
          apply: "Apply",
          reset: "Reset",
          all: "All",
          actionOpen: "Open",
          actionDca: "DCA",
          actionClose: "Close",
          time: "Time",
          qty: "Qty",
          price: "Price",
          fee: "Fee",
          realizedPnl: "Realized PnL",
          origin: "Origin",
          noTradeHistory: "No trade history.",
          recordsBadge: "Records: {total}",
          pageBadge: "Page {page}/{totalPages}",
          rows: "Rows",
          previous: "Previous",
          next: "Next",
          liveChecksTitle: "Live checks",
          pairsCount: "{count} pairs",
          noSignalConditions: "No signal, conditions not met.",
          noSignalData: "No signal data.",
          long: "LONG",
          short: "SHORT",
          runtimeRiskTitle: "Bot runtime and risk",
          selectedBot: "Selected bot",
          status: "Status",
          mode: "Mode",
          heartbeat: "Heartbeat",
          openPositions: "Open positions",
          signalsDca: "Signals / DCA",
          netPnl: "Net PnL",
          noSession: "NO_SESSION",
          noActiveSessionWarning:
            "No active runtime session. Check if execution and market-stream workers are running.",
          capitalRiskTitle: "Capital and risk",
          portfolio: "Portfolio",
          deltaFromStart: "Delta from start",
          freeFunds: "Free funds",
          fundsInPositions: "Funds in positions",
          exposure: "Exposure",
          realizedOpen: "Realized / Open",
          winRate: "Win rate",
          maxDrawdown: "Max drawdown",
          updatedAt: "Updated at: {value}",
        },
      },
    },
  },
  pl: {
    dashboard: {
      nav: {
        markets: "Rynki",
        builder: "Builder",
        strategies: "Strategie",
        backtest: "Backtest",
        reports: "Raporty",
        logs: "Logi",
        exchanges: "Gieldy",
        orders: "Zlecenia",
        positions: "Pozycje",
        bots: "Boty",
      },
      common: {
        dashboard: "Dashboard",
        add: "Dodaj",
        language: "Jezyk",
        english: "Angielski",
        polish: "Polski",
      },
      footer: {
        rights: "Wszelkie prawa zastrzezone.",
      },
      logs: {
        title: "Dziennik audytu",
        breadcrumbLogs: "Logi",
        loading: "Ladowanie dziennika audytu",
        loadErrorTitle: "Nie udalo sie zaladowac dziennika audytu",
        loadErrorDescription: "Nie udalo sie pobrac logow audytu.",
        retry: "Sprobuj ponownie",
        emptyTitle: "Brak zdarzen audytu",
        emptyDescription: "Brak wpisow logow dla wybranych filtrow.",
        loadedTitle: "Dziennik audytu zaladowany",
        loadedDescription: "Wczytano {count} zdarzen.",
        sourceFilterLabel: "Filtr zrodla",
        severityFilterLabel: "Filtr poziomu",
        sourceAll: "Wszystkie zrodla",
        severityAll: "Wszystkie poziomy",
        refresh: "Odswiez",
        tableTime: "Czas",
        tableSource: "Zrodlo",
        tableSeverity: "Poziom",
        tableAction: "Akcja",
        tableActor: "Aktor",
        tableDetails: "Szczegoly",
        tableTrace: "Trace",
        actorFallback: "-",
        traceButton: "Pokaz trace",
        traceTitle: "Decision trace",
        traceDescription: "Metadane wybranego zdarzenia i kontekst decyzji.",
        traceNoMetadata: "Brak metadanych dla tego zdarzenia.",
      },
      liveMarket: {
        title: "Pasek rynku live",
        streamDisconnected: "strumien rozlaczony",
        streamConnected: "strumien polaczony",
        streamConnectedLag: "strumien polaczony (lag {lag}ms)",
        noCandle: "brak swiecy",
        candleFresh: "swieza",
        candleAgoSeconds: "{seconds}s temu",
        candleAgoMinutes: "{minutes}m temu",
        delta24hLabel: "24h",
        valueUnknown: "--",
      },
      home: {
        loadWidgets: "Ladowanie widgetow live snapshot",
        loadWidgetsErrorTitle: "Nie udalo sie zaladowac widgetow dashboard",
        loadWidgetsErrorDescription: "Nie udalo sie pobrac widgetow dashboard.",
        noTradingDataTitle: "Brak danych tradingowych",
        noTradingDataDescription: "Gdy pojawia sie orders lub positions, zobaczysz tu live snapshot i feed aktywnosci.",
        openPositions: "Otwarte pozycje",
        openOrders: "Otwarte zlecenia",
        filledOrders: "Zrealizowane zlecenia",
        rejectedOrders: "Odrzucone zlecenia",
        positionsSnapshot: "Podglad pozycji",
        noOpenPositionsTitle: "Brak otwartych pozycji",
        noOpenPositionsDescription: "W tej chwili nie ma aktywnych positions.",
        positionsAction: "Przejdz do pozycji",
        controlCenterTitle: "Sciezki centrum sterowania",
        controlCenterDescription:
          "Wybierz kolejny krok operacyjny bez przeskakiwania miedzy modulami i zachowaj pelny kontekst.",
        controlCenterBadge: "Dashboard globalny",
        runtimeOpsTitle: "Operacje runtime botow",
        runtimeOpsDescription: "Podglad otwartych pozycji, historii i live-check sygnalow w jednym module operacyjnym.",
        runtimeOpsMeta: "Otwarte pozycje: {positions} | Otwarte zlecenia: {orders}",
        runtimeOpsAction: "Przejdz do Operacji Botow",
        runtimeOpsActionShort: "Runtime botow",
        strategyLabTitle: "Sciezka strategii i backtestu",
        strategyLabDescription: "Przygotuj i zweryfikuj pomysly zanim uruchomisz runtime.",
        strategyLabPrimaryAction: "Strategie",
        strategyLabSecondaryAction: "Backtesty",
        executionReviewTitle: "Sciezka kontroli egzekucji",
        executionReviewDescription: "Sprawdz wynik wykonania, pending i aktualna ekspozycje.",
        executionReviewPrimaryAction: "Zlecenia",
        executionReviewSecondaryAction: "Pozycje",
        laneStepOne: "Krok 1",
        laneStepTwo: "Krok 2",
        laneStepThree: "Krok 3",
        quickActionsStripTitle: "Szybkie akcje",
        quickActionsStripDescription: "Wybierz jedna akcje i przejdz dalej.",
        quickActionsPrimaryLabel: "Sciezka glowna",
        quickActionsSecondaryLabel: "Sciezki pomocnicze",
        quickActionStrategies: "Strategie",
        quickActionBacktests: "Backtesty",
        quickActionOrders: "Zlecenia",
        quickActionReports: "Raporty",
        handoffCuesTitle: "Wskazniki przekazania miedzy modulami",
        handoffRuntimeCue: "Runtime live -> Boty",
        handoffBacktestCue: "Walidacja -> Backtesty",
        handoffReportsCue: "Przeglad wynikow -> Raporty",
        statusRuntimeNowLabel: "Runtime teraz",
        statusRuntimeNowValue: "{positions} pozycji | {orders} zlecen",
        statusExecutionQualityLabel: "Jakosc egzekucji",
        statusExecutionQualityValue: "{filled} zrealizowanych | {rejected} odrzuconych",
        statusActivityLabel: "Najnowsza aktywnosc",
        statusActivityValue: "{count} ostatnich zdarzen",
        statusRiskWatchLabel: "Monitoring ryzyka",
        statusRiskWatchValue: "{pending} oczekujacych | {rejected} odrzuconych",
        statusLatestEventLabel: "Ostatnie zdarzenie",
        statusLatestEventValue: "O {time}",
        statusNoActivityValue: "Brak ostatnich zdarzen",
        quickActions: "Szybkie akcje",
        reviewStrategies: "Przejrzyj strategie",
        openOrdersAction: "Przejdz do zlecen",
        runBacktest: "Uruchom backtest",
        ordersSnapshot: "Podglad zlecen",
        pending: "Oczekujace",
        recentActivity: "Ostatnia aktywnosc",
        noActivityTitle: "Brak aktywnosci",
        noActivityDescription: "Feed pojawi sie po pierwszych orders/positions.",
        activityTableTime: "Czas",
        activityTableEvent: "Zdarzenie",
        liveSnapshotSyncedTitle: "Live snapshot zsynchronizowany",
        liveSnapshotSyncedDescription: "Otwarte pozycje: {positions}, otwarte zlecenia: {orders}.",
        activityPositionOpened: "{side} {symbol} otwarte (x{leverage}).",
        activityOrder: "{type} {symbol} {side} ({status}).",
        side: "Kierunek",
        quantity: "Ilosc",
        leverage: "Dzwignia",
        unrealizedPnl: "Niezrealizowany PnL",
        pageTitle: "Centrum sterowania",
        pageBreadcrumb: "Centrum sterowania",
        runtime: {
          loadingTitle: "Ladowanie dashboardu operacyjnego",
          errorTitle: "Nie udalo sie zaladowac dashboardu operacyjnego",
          errorRetry: "Sprobuj ponownie",
          noBotsTitle: "Brak botow do podsumowania dashboardu",
          noBotsDescription: "Dodaj pierwszego bota, aby uruchomic centrum operacyjne.",
          addBot: "Dodaj bota",
          goToStrategies: "Przejdz do strategii",
          noActiveBotsTitle: "Brak aktywnych botow na dashboardzie",
          noActiveBotsDescription: "Aktywuj co najmniej jednego bota, aby zobaczyc live runtime.",
          goToBots: "Przejdz do botow",
          openPositionsTitle: "Otwarte pozycje",
          timeOpened: "Czas otwarcia",
          symbol: "Symbol",
          side: "Side",
          margin: "Margin",
          pnl: "PnL",
          pnlPercent: "PnL %",
          dca: "DCA",
          slTtp: "SL (TTP)",
          slTsl: "SL (TSL)",
          noOpenPositions: "Brak otwartych pozycji.",
          tradesHistoryTitlePaper: "Historia transakcji",
          tradesHistoryTitleLive: "Zlecenia i historia transakcji",
          filterSymbol: "Symbol",
          filterSide: "Side",
          filterAction: "Action",
          filterFrom: "Od",
          filterTo: "Do",
          apply: "Zastosuj",
          reset: "Reset",
          all: "Wszystkie",
          actionOpen: "Otwarcie",
          actionDca: "DCA",
          actionClose: "Zamkniecie",
          time: "Czas",
          qty: "Qty",
          price: "Price",
          fee: "Fee",
          realizedPnl: "Realized PnL",
          origin: "Origin",
          noTradeHistory: "Brak historii transakcji.",
          recordsBadge: "Rekordy: {total}",
          pageBadge: "Strona {page}/{totalPages}",
          rows: "Wierszy",
          previous: "Poprzednia",
          next: "Nastepna",
          liveChecksTitle: "Live checks",
          pairsCount: "{count} par",
          noSignalConditions: "Brak sygnalu, warunki niespelnione.",
          noSignalData: "Brak danych sygnalowych.",
          long: "LONG",
          short: "SHORT",
          runtimeRiskTitle: "Bot runtime i ryzyko",
          selectedBot: "Wybrany bot",
          status: "Status",
          mode: "Tryb",
          heartbeat: "Heartbeat",
          openPositions: "Pozycje otwarte",
          signalsDca: "Sygnaly / DCA",
          netPnl: "Net PnL",
          noSession: "NO_SESSION",
          noActiveSessionWarning: "Brak aktywnej sesji runtime. Sprawdz, czy dzialaja workery execution oraz market-stream.",
          capitalRiskTitle: "Kapital i ryzyko",
          portfolio: "Portfel",
          deltaFromStart: "Zmiana od startu",
          freeFunds: "Wolne srodki",
          fundsInPositions: "Srodki w pozycjach",
          exposure: "Ekspozycja",
          realizedOpen: "Realized / Open",
          winRate: "Win rate",
          maxDrawdown: "Max drawdown",
          updatedAt: "Aktualizacja: {value}",
        },
      },
    },
  },
};

export const DEFAULT_LOCALE: Locale = "en";

type NestedTranslationKey<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${NestedTranslationKey<T[K]>}`;
    }[keyof T & string];

export type TranslationKey = NestedTranslationKey<TranslationSchema>;
