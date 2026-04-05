export type Locale = "en" | "pl";

type TranslationSchema = {
  dashboard: {
    nav: {
      home: string;
      analytics: string;
      markets: string;
      builder: string;
      strategies: string;
      backtest: string;
      backtests: string;
      reports: string;
      logs: string;
      exchanges: string;
      connections: string;
      orders: string;
      positions: string;
      bots: string;
      marketGroupsList: string;
      createMarketGroup: string;
      strategiesList: string;
      createStrategy: string;
      backtestsList: string;
      createBacktest: string;
      botsList: string;
      createBot: string;
      menu: string;
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
        onboardingBadge: string;
        onboardingPrimaryCta: string;
        onboardingSecondaryCta: string;
        onboardingStepMarketsTitle: string;
        onboardingStepMarketsDescription: string;
        onboardingStepMarketsCta: string;
        onboardingStepStrategyTitle: string;
        onboardingStepStrategyDescription: string;
        onboardingStepStrategyCta: string;
        onboardingStepBacktestTitle: string;
        onboardingStepBacktestDescription: string;
        onboardingStepBacktestCta: string;
        onboardingStepBotTitle: string;
        onboardingStepBotDescription: string;
        onboardingStepBotCta: string;
        openPositionsTitle: string;
        openOrdersTitle: string;
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
        openOrdersPlaceholder: string;
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
        reason: string;
        reasonSignalEntry: string;
        reasonDcaLevel: string;
        reasonTakeProfit: string;
        reasonStopLoss: string;
        reasonTrailingTakeProfit: string;
        reasonTrailingStop: string;
        reasonSignalExit: string;
        reasonManual: string;
        reasonUnknown: string;
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
        liveChecksSubtitle: string;
        pairsCount: string;
        markets: string;
        signals: string;
        baseCurrency: string;
        signalRailPrev: string;
        signalRailNext: string;
        noSignalConditions: string;
        noSignalData: string;
        long: string;
        short: string;
        runtimeRiskTitle: string;
        walletTitle: string;
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
        inPositionsShort: string;
        exposure: string;
        realizedOpen: string;
        winRate: string;
        maxDrawdown: string;
        updatedAt: string;
      };
    };
    bots: Record<string, unknown>;
  };
};

export const translations: Record<Locale, TranslationSchema> = {
  en: {
    dashboard: {
      nav: {
        home: "Dashboard",
        analytics: "Analytics",
        markets: "Markets",
        builder: "Builder",
        strategies: "Strategies",
        backtest: "Backtest",
        backtests: "Backtests",
        reports: "Reports",
        logs: "Logs",
        exchanges: "Exchanges",
        connections: "Connections",
        orders: "Orders",
        positions: "Positions",
        bots: "Bots",
        marketGroupsList: "Groups list",
        createMarketGroup: "Create group",
        strategiesList: "Strategies list",
        createStrategy: "Create strategy",
        backtestsList: "Backtests list",
        createBacktest: "Create backtest",
        botsList: "Bots list",
        createBot: "Create bot",
        menu: "Menu",
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
          onboardingBadge: "Quick start",
          onboardingPrimaryCta: "Create and activate bot",
          onboardingSecondaryCta: "Open bots list",
          onboardingStepMarketsTitle: "Create market universe",
          onboardingStepMarketsDescription: "Build market groups with exchange, market type and symbols.",
          onboardingStepMarketsCta: "Open markets",
          onboardingStepStrategyTitle: "Create strategy",
          onboardingStepStrategyDescription: "Define entry, exit and risk rules for automation.",
          onboardingStepStrategyCta: "Open strategies",
          onboardingStepBacktestTitle: "Test in backtester",
          onboardingStepBacktestDescription: "Validate strategy behavior before runtime activation.",
          onboardingStepBacktestCta: "Open backtests",
          onboardingStepBotTitle: "Create and activate bot",
          onboardingStepBotDescription: "Assign strategy + markets, then start bot session.",
          onboardingStepBotCta: "Open bot creator",
          openPositionsTitle: "Open positions",
          openOrdersTitle: "Open orders",
          timeOpened: "Time",
          symbol: "Symbol",
          side: "Side",
          margin: "Margin",
          pnl: "PnL",
          pnlPercent: "PnL %",
          dca: "DCA",
          slTtp: "TTP",
          slTsl: "TSL",
          noOpenPositions: "No open positions.",
          openOrdersPlaceholder: "Open orders tab is prepared and will be filled in upcoming runtime updates.",
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
          reason: "Reason",
          reasonSignalEntry: "Signal",
          reasonDcaLevel: "DCA level",
          reasonTakeProfit: "TP",
          reasonStopLoss: "SL",
          reasonTrailingTakeProfit: "TTP",
          reasonTrailingStop: "TSL",
          reasonSignalExit: "Signal exit",
          reasonManual: "Manual",
          reasonUnknown: "-",
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
          liveChecksTitle: "Strategy signals",
          liveChecksSubtitle: "Signals computed from latest market checks against active strategy rules.",
          pairsCount: "{count} pairs",
          markets: "Markets",
          signals: "Signals",
          baseCurrency: "Base currency",
          signalRailPrev: "Prev",
          signalRailNext: "Next",
          noSignalConditions: "No signal, conditions not met.",
          noSignalData: "No signal data.",
          long: "LONG",
          short: "SHORT",
          runtimeRiskTitle: "Bot runtime and risk",
          walletTitle: "Wallet",
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
          inPositionsShort: "In positions",
          exposure: "Exposure",
          realizedOpen: "Realized / Open",
          winRate: "Win rate",
          maxDrawdown: "Max drawdown",
          updatedAt: "Updated at: {value}",
        },
      },
      bots: {
        page: {
          title: "Bots Operations Center",
          breadcrumb: "Bots Operations",
          alertPrefix: "Module",
          alertMiddle: "is used for runtime operations. Global app overview and account context are available in",
          alertSuffix: ".",
        },
        tabs: {
          bots: "Bots",
          monitoring: "Runtime operations",
          assistant: "Assistant",
        },
        create: {
          title: "New bot",
          description: "Add a bot and select strategy + market group. LIVE requires opt-in.",
          sectionBasics: "1. Bot basics",
          nameLabel: "Name",
          namePlaceholder: "Momentum Runner",
          nameAria: "Bot name",
          modeLabel: "Mode",
          modeAria: "Bot mode",
          paperBalanceLabel: "Paper start balance",
          paperBalanceAria: "Paper start balance",
          sectionMarket: "2. Market context",
          marketGroupLabel: "Market group",
          marketGroupAria: "Bot market group",
          noMarketGroups: "No market groups",
          marketSummaryLabel: "Exchange / market",
          whitelistLabel: "Whitelist",
          blacklistLabel: "Blacklist",
          sectionStrategy: "3. Strategy context",
          strategyLabel: "Strategy",
          strategyAria: "Bot strategy",
          noStrategies: "No strategies",
          intervalLabel: "Interval",
          leverageLabel: "Leverage",
          maxOpenLabel: "Max open positions",
          placeholderActivationBlocked:
            "Selected exchange is in placeholder mode. Bot activation is unavailable.",
          placeholderActivationHint:
            "Placeholder exchange selected. Runtime activation for {mode} mode is not implemented yet.",
          creatingCta: "Creating...",
          createCta: "Add bot",
        },
        states: {
          loadingBots: "Loading bots",
          loadBotsFailedTitle: "Failed to load bots",
          retry: "Try again",
          emptyTitle: "No bots",
          emptyDescription: "Add your first bot to control PAPER/LIVE mode and limits.",
          successTitle: "Bots control center active",
          successDescriptionOne: "Configured {count} bot.",
          successDescriptionMany: "Configured {count} bots.",
        },
        list: {
          marketFilterLabel: "Market filter",
          marketFilterAria: "Bot market filter",
          allMarkets: "All",
          columns: {
            name: "Name",
            market: "Market",
            position: "Position",
            strategy: "Strategy",
            status: "Status",
            mode: "Mode",
            paperBalance: "Paper balance",
            maxPositions: "Max positions",
            liveOptIn: "Live opt-in",
            active: "Active",
            actions: "Actions",
          },
          noneOption: "None",
          modeLabel: "Mode: {mode}",
          saving: "Saving...",
          edit: "Edit",
          save: "Save",
          deleting: "Deleting...",
          delete: "Delete",
          placeholderBadge: "PLACEHOLDER",
          noBotsForFilter: "No bots for the selected market.",
          searchPlaceholder: "Search bots (e.g. BTCUSDT)",
        },
        badges: {
          liveEnabled: "LIVE enabled",
          liveBlocked: "LIVE blocked",
          safeMode: "Safe mode",
        },
        errors: {
          loadBots: "Failed to load bots.",
          loadRuntimeSessions: "Failed to load runtime sessions.",
          loadRuntimeSessionData: "Failed to load runtime session data.",
          loadAggregateMonitoring: "Failed to load aggregate monitoring data.",
        },
        confirms: {
          liveCreate: "LIVE confirmation: this bot will be created in LIVE mode. Continue?",
          liveSave: "LIVE confirmation: saving will enable live trading risk. Continue?",
          liveDelete: "LIVE confirmation: deleting this bot will stop active trading config. Continue?",
        },
        toasts: {
          marketGroupsLoadFailed: "Failed to load market groups",
          created: "Bot created",
          duplicateActiveTitle: "An active bot for this strategy and group already exists",
          duplicateActiveDescription: "Disable previous bot or choose different strategy / market group.",
          createFailed: "Failed to create bot",
          updated: "Bot updated",
          activeConflictTitle: "Active bot conflict",
          activeConflictDescription: "This strategy and market group are already active in another bot.",
          saveFailed: "Failed to save changes",
          deleted: "Bot deleted",
          deleteFailed: "Failed to delete bot",
        },
        actions: {
          open: "Open",
          dca: "DCA",
          close: "Close",
          unknown: "Unknown",
        },
        monitoring: {
          title: "Bots operations center (runtime)",
          description:
            "Dashboard stays the global control panel, while here you monitor bot runtime: now, history and future signals without heavy charts.",
          emptyBotsTitle: "No bots",
          emptyBotsDescription: "Create a bot to monitor runtime sessions.",
          quickContextTitle: "Quick bot context switch",
          cardsCount: "{count} cards",
          cardsActiveSuffix: " (active)",
          cardsAllSuffix: " (all)",
          controlsTitle: "Monitoring controls",
          controlsDescription: "Set scope and filters, then watch now/history/live-check without remount flicker.",
          autoRefreshAria: "Monitoring auto refresh",
          autoRefreshLabel: "Runtime auto refresh (5s)",
          refresh: "Refresh",
          sessionStatusLabel: "Session status",
          sessionStatusAll: "ALL",
          symbolFilterLabel: "Symbol filter (optional)",
          symbolFilterPlaceholder: "e.g. BTCUSDT",
          symbolFilterHint: "Tip: enter e.g. BTCUSDT and press Enter to narrow all monitoring sections.",
          applyFilter: "Apply",
          clearFilter: "Clear",
          activeFilterLabel: "Active filter",
          none: "none",
          autoRefreshAggregate: "Auto-refresh active for aggregate view.",
          autoRefreshCurrentSession: "Auto-refresh active for current session.",
          autoRefreshSelectedSession: "Auto-refresh active for selected session.",
          advancedOptions: "Advanced options",
          botManualLabel: "Bot (manual select)",
          viewLabel: "View",
          viewAggregate: "Aggregate (default)",
          viewSession: "Session (advanced)",
          sessionLabel: "Session",
          noSessionsOption: "No sessions",
          scopeLabel: "Scope",
          scopeAllSessions: "All sessions ({count})",
          quickNavTitle: "Runtime quick navigation",
          quickNavNow: "1. Now",
          quickNavHistory: "2. History",
          quickNavFuture: "3. Future",
          quickNavDescription:
            "Jump directly to operational sections: open positions, execution history and live signal checks.",
          loadingSessions: "Loading runtime sessions",
          loadErrorTitle: "Failed to load monitoring",
          emptySessionsTitle: "No runtime sessions",
          emptySessionsDescription:
            "Bot has not started a monitoring session yet or status filter returned nothing. Ensure execution + market-stream workers are running.",
          sessionModeBadge: "Mode: {mode}",
          sessionsBadge: "Sessions: {count}",
          sessionIdBadge: "Session ID: {id}",
          startLabel: "Start:",
          endLabel: "End:",
          heartbeatLabel: "Heartbeat:",
          durationLabel: "Duration:",
          checklist: {
            title: "Operator checklist",
            summary: "{ok}/{total} OK",
            ok: "OK",
            check: "CHECK",
            sessionActive: "Session active",
            heartbeatFresh: "Heartbeat fresh",
            positionData: "Positions data",
            openCount: "{count} open",
            signalData: "Signal data",
            noSessionErrors: "No session errors",
            reviewRequired: "needs review",
            none: "none",
          },
          loadingSessionData: "Loading session data",
          nowTitle: "What is now",
          openPositionsLabel: "Open positions:",
          openOrdersLabel: "Open orders:",
          openPnlLabel: "Open PnL:",
          wasTitle: "What was",
          closedTradesLabel: "Closed trades:",
          winRateLabel: "Win rate:",
          realizedPnlLabel: "Realized PnL:",
          futureTitle: "What will be",
          trackedSymbolsLabel: "Tracked symbols:",
          signalsLabel: "Signals:",
          dcaLabel: "DCA:",
          feesLabel: "Fees:",
          operatorCheckTitle: "Quick operator check",
          heartbeatLagLabel: "Heartbeat lag",
          lastSignalLabel: "Last signal",
          lastTradeLabel: "Last trade",
          openPositionsOrdersLabel: "Open positions / orders",
          sections: {
            nowOpenPositionsTitle: "1. Now - open positions",
            nowOpenPositionsDescription: "Immediate control of what is active right now.",
            nowOpenOrdersTitle: "Now - open orders",
            historyPositionsTitle: "2. History - positions",
            historyPositionsDescription: "Verify what already happened: result, pace and execution quality.",
            historyTradesTitle: "History - operational trade log",
            futureSignalsTitle: "3. Future - live signal check",
            futureSignalsDescription:
              "Quick assessment which symbol has LONG/SHORT/EXIT signal or no signal.",
          },
          notionalLabel: "Notional",
          marginLabel: "Margin",
          marginInitLabel: "Margin/init",
          activeCount: "{count} / {total} active",
          table: {
            timeOpened: "Time opened",
            symbol: "Symbol",
            side: "Side",
            qty: "Qty",
            entry: "Entry",
            mark: "Mark",
            exit: "Exit",
            price: "Price",
            margin: "Margin",
            fees: "Fees",
            fee: "Fee",
            feePct: "Fee %",
            openPnl: "Open PnL",
            openPct: "Open %",
            realizedPnl: "Realized PnL",
            pnlPct: "PnL %",
            roiMarginPct: "ROI % (margin)",
            cumulativePnl: "Cumulative PnL",
            dca: "DCA",
            signals: "Signals",
            lse: "L/S/E",
            closed: "Closed",
            wl: "W/L",
            openQty: "Open qty",
            origin: "Origin",
            order: "Order",
            position: "Position",
            lastTrade: "Last trade",
            slTtp: "TTP",
            slTsl: "TSL",
            status: "Status",
            type: "Type",
            filled: "Filled",
            stop: "Stop",
            submitted: "Submitted",
            open: "Open",
            close: "Close",
            duration: "Duration",
            time: "Time",
            action: "Action",
            signal: "Signal",
            signalTime: "Signal time",
          },
          emptyOpenPositions: "No open positions in this session.",
          emptyOpenOrders: "No open orders.",
          closedCount: "{count} / {total} closed",
          recordsCount: "{count} / {total} records",
          emptyClosedPositions: "No closed positions in this session.",
          emptyTrades: "No trades for this session and filter.",
          symbolCount: "{count} / {total} symbols",
          sortLatestSignal: "Sort: latest signal",
          neutral: "NEUTRAL",
          emptySignalData: "No live signal data for this session and filter.",
          active: "ACTIVE",
          inactive: "INACTIVE",
        },
        assistant: {
          title: "Assistant configuration",
          description: "Main assistant configuration and 4 subagent slots per bot.",
          emptyTitle: "No bots",
          emptyDescription: "Create a bot first to configure Assistant.",
          botLabel: "Bot",
          loading: "Loading assistant configuration",
          mainEnabledLabel: "Main enabled",
          mandateLabel: "Mandate",
          mandatePlaceholder: "Trade only with clear risk-adjusted edge",
          modelProfileLabel: "Model profile",
          safetyModeLabel: "Safety mode",
          mainLatencyLabel: "Main latency (ms)",
          saving: "Saving...",
          saveMain: "Save main config",
          subagentSlotTitle: "Subagent slot {slot}",
          enabledLabel: "Enabled",
          roleLabel: "Role",
          profileLabel: "Profile",
          timeoutLabel: "Timeout (ms)",
          safetyLabel: "Safety",
          saveSlot: "Save slot",
          deleteSlot: "Delete slot",
          decisionTimelineTitle: "Decision timeline (dry-run)",
          symbolLabel: "Symbol",
          intervalLabel: "Interval",
          running: "Running...",
          runDryRun: "Run dry-run",
          traceRequest: "Request",
          traceMode: "Mode",
          traceFinalDecision: "Final decision",
          traceReason: "Reason",
          traceTableSlot: "Slot",
          traceTableRole: "Role",
          traceTableStatus: "Status",
          traceTableLatency: "Latency (ms)",
          traceTableMessage: "Message",
          toasts: {
            loadFailed: "Failed to load assistant configuration",
            mainSaved: "Main assistant config saved",
            mainSaveFailed: "Failed to save assistant configuration",
            slotSaved: "Slot {slot} saved",
            slotSaveFailed: "Failed to save subagent slot",
            slotDeleted: "Slot {slot} deleted",
            slotDeleteFailed: "Failed to delete subagent slot",
            dryRunReady: "Assistant dry-run ready",
            dryRunFailed: "Failed to run assistant dry-run",
          },
        },
      },
    },
  },
  pl: {
    dashboard: {
      nav: {
        home: "Pulpit",
        analytics: "Analityka",
        markets: "Rynki",
        builder: "Builder",
        strategies: "Strategie",
        backtest: "Backtest",
        backtests: "Backtesty",
        reports: "Raporty",
        logs: "Logi",
        exchanges: "Gieldy",
        connections: "Integracje",
        orders: "Zlecenia",
        positions: "Pozycje",
        bots: "Boty",
        marketGroupsList: "Lista grup",
        createMarketGroup: "Dodaj grupe",
        strategiesList: "Lista strategii",
        createStrategy: "Dodaj strategie",
        backtestsList: "Lista backtestow",
        createBacktest: "Nowy backtest",
        botsList: "Lista botow",
        createBot: "Dodaj bota",
        menu: "Menu",
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
          onboardingBadge: "Szybki start",
          onboardingPrimaryCta: "Stworz i aktywuj bota",
          onboardingSecondaryCta: "Otworz liste botow",
          onboardingStepMarketsTitle: "Stworz uniwersum rynkow",
          onboardingStepMarketsDescription: "Zbuduj grupy rynkow: gielda, typ rynku i symbole.",
          onboardingStepMarketsCta: "Otworz rynki",
          onboardingStepStrategyTitle: "Stworz strategie",
          onboardingStepStrategyDescription: "Zdefiniuj warunki wejscia, wyjscia i ryzyko.",
          onboardingStepStrategyCta: "Otworz strategie",
          onboardingStepBacktestTitle: "Przetestuj w backtesterze",
          onboardingStepBacktestDescription: "Zweryfikuj strategie na danych historycznych.",
          onboardingStepBacktestCta: "Otworz backtesty",
          onboardingStepBotTitle: "Stworz i aktywuj bota",
          onboardingStepBotDescription: "Podepnij strategie i rynki, potem uruchom sesje.",
          onboardingStepBotCta: "Otworz kreator bota",
          openPositionsTitle: "Otwarte pozycje",
          openOrdersTitle: "Otwarte zlecenia",
          timeOpened: "Czas",
          symbol: "Symbol",
          side: "Side",
          margin: "Margin",
          pnl: "PnL",
          pnlPercent: "PnL %",
          dca: "DCA",
          slTtp: "TTP",
          slTsl: "TSL",
          noOpenPositions: "Brak otwartych pozycji.",
          openOrdersPlaceholder: "Zakladka otwartych zlecen jest gotowa i bedzie uzupelniona w kolejnych aktualizacjach runtime.",
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
          reason: "Powod",
          reasonSignalEntry: "Sygnal",
          reasonDcaLevel: "Poziom DCA",
          reasonTakeProfit: "TP",
          reasonStopLoss: "SL",
          reasonTrailingTakeProfit: "TTP",
          reasonTrailingStop: "TSL",
          reasonSignalExit: "Wyjscie sygnalem",
          reasonManual: "Manualnie",
          reasonUnknown: "-",
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
          liveChecksTitle: "Sygnaly strategii",
          liveChecksSubtitle: "Sygnaly obliczone na podstawie najnowszych danych i warunkow aktywnej strategii.",
          pairsCount: "{count} par",
          markets: "Rynki",
          signals: "Sygnaly",
          baseCurrency: "Base currency",
          signalRailPrev: "Wstecz",
          signalRailNext: "Dalej",
          noSignalConditions: "Brak sygnalu, warunki niespelnione.",
          noSignalData: "Brak danych sygnalowych.",
          long: "LONG",
          short: "SHORT",
          runtimeRiskTitle: "Bot runtime i ryzyko",
          walletTitle: "Portfel",
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
          inPositionsShort: "W pozycjach",
          exposure: "Ekspozycja",
          realizedOpen: "Realized / Open",
          winRate: "Win rate",
          maxDrawdown: "Max drawdown",
          updatedAt: "Aktualizacja: {value}",
        },
      },
      bots: {
        page: {
          title: "Centrum operacyjne botow",
          breadcrumb: "Operacje botow",
          alertPrefix: "Modul",
          alertMiddle: "sluzy do operacji runtime. Globalny podglad aplikacji i przekroj konta masz w",
          alertSuffix: ".",
        },
        tabs: {
          bots: "Boty",
          monitoring: "Operacje runtime",
          assistant: "Asystent",
        },
        create: {
          title: "Nowy bot",
          description: "Dodaj bota i wybierz strategie + grupe rynkow. LIVE wymaga opt-in.",
          sectionBasics: "1. Podstawy bota",
          nameLabel: "Nazwa",
          namePlaceholder: "Momentum Runner",
          nameAria: "Nazwa bota",
          modeLabel: "Tryb",
          modeAria: "Tryb bota",
          paperBalanceLabel: "Paper start balance",
          paperBalanceAria: "Paper start balance",
          sectionMarket: "2. Kontekst rynku",
          marketGroupLabel: "Grupa rynkow",
          marketGroupAria: "Grupa rynkow bota",
          noMarketGroups: "Brak grup rynkow",
          marketSummaryLabel: "Gielda / rynek",
          whitelistLabel: "Whitelist",
          blacklistLabel: "Blacklist",
          sectionStrategy: "3. Kontekst strategii",
          strategyLabel: "Strategia",
          strategyAria: "Strategia bota",
          noStrategies: "Brak strategii",
          intervalLabel: "Interwal",
          leverageLabel: "Dzwignia",
          maxOpenLabel: "Max open positions",
          placeholderActivationBlocked:
            "Wybrana gielda dziala jako placeholder. Aktywacja bota jest niedostepna.",
          placeholderActivationHint:
            "Wybrana gielda dziala jako placeholder. Aktywacja runtime dla trybu {mode} nie jest jeszcze wdrozona.",
          creatingCta: "Tworzenie...",
          createCta: "Dodaj bota",
        },
        states: {
          loadingBots: "Ladowanie botow",
          loadBotsFailedTitle: "Nie udalo sie pobrac botow",
          retry: "Sprobuj ponownie",
          emptyTitle: "Brak botow",
          emptyDescription: "Dodaj pierwszego bota, aby kontrolowac tryb PAPER/LIVE i limity.",
          successTitle: "Bots control center aktywny",
          successDescriptionOne: "Skonfigurowano {count} bota.",
          successDescriptionMany: "Skonfigurowano {count} botow.",
        },
        list: {
          marketFilterLabel: "Filtr rynku",
          marketFilterAria: "Filtr rynku botow",
          allMarkets: "Wszystkie",
          columns: {
            name: "Nazwa",
            market: "Rynek",
            position: "Pozycja",
            strategy: "Strategia",
            status: "Status",
            mode: "Tryb",
            paperBalance: "Paper balance",
            maxPositions: "Max positions",
            liveOptIn: "Live opt-in",
            active: "Aktywny",
            actions: "Akcje",
          },
          noneOption: "Brak",
          modeLabel: "Mode: {mode}",
          saving: "Zapisywanie...",
          edit: "Edytuj",
          save: "Zapisz",
          deleting: "Usuwanie...",
          delete: "Usun",
          placeholderBadge: "PLACEHOLDER",
          noBotsForFilter: "Brak botow dla wybranego rynku.",
          searchPlaceholder: "Szukaj botow (np. BTCUSDT)",
        },
        badges: {
          liveEnabled: "LIVE enabled",
          liveBlocked: "LIVE blocked",
          safeMode: "Safe mode",
        },
        errors: {
          loadBots: "Nie udalo sie pobrac botow.",
          loadRuntimeSessions: "Nie udalo sie pobrac sesji runtime.",
          loadRuntimeSessionData: "Nie udalo sie pobrac danych sesji runtime.",
          loadAggregateMonitoring: "Nie udalo sie pobrac danych monitoringu zbiorczego.",
        },
        confirms: {
          liveCreate: "Potwierdzenie LIVE: ten bot bedzie tworzony w trybie LIVE. Kontynuowac?",
          liveSave: "Potwierdzenie LIVE: zapis aktywuje ryzyko handlu na zywo. Kontynuowac?",
          liveDelete: "Potwierdzenie LIVE: usuniecie tego bota zatrzyma aktywna konfiguracje tradingowa. Kontynuowac?",
        },
        toasts: {
          marketGroupsLoadFailed: "Nie udalo sie pobrac grup rynkow",
          created: "Bot utworzony",
          duplicateActiveTitle: "Aktywny bot dla tej strategii i grupy juz istnieje",
          duplicateActiveDescription: "Wylacz poprzedniego bota albo wybierz inna strategie / grupe rynkow.",
          createFailed: "Nie udalo sie utworzyc bota",
          updated: "Bot zaktualizowany",
          activeConflictTitle: "Konflikt aktywnych botow",
          activeConflictDescription: "Ta strategia i grupa rynkow sa juz aktywne w innym bocie.",
          saveFailed: "Nie udalo sie zapisac zmian",
          deleted: "Bot usuniety",
          deleteFailed: "Nie udalo sie usunac bota",
        },
        actions: {
          open: "Otwarcie",
          dca: "DCA",
          close: "Zamkniecie",
          unknown: "Nieznane",
        },
        monitoring: {
          title: "Centrum operacyjne botow (runtime)",
          description:
            "Dashboard zostaje ogolnym panelem sterowania aplikacja, a tutaj monitorujesz runtime botow: teraz, historia i live-check sygnalow bez ciezkich wykresow.",
          emptyBotsTitle: "Brak botow",
          emptyBotsDescription: "Utworz bota, aby monitorowac jego sesje runtime.",
          quickContextTitle: "Szybki wybor kontekstu bota",
          cardsCount: "{count} kart",
          cardsActiveSuffix: " (aktywne)",
          cardsAllSuffix: " (wszystkie)",
          controlsTitle: "Sterowanie monitoringiem",
          controlsDescription: "Ustaw zakres i filtr, a potem obserwuj teraz/historie/live-check bez przeladowan sekcji.",
          autoRefreshAria: "Auto refresh monitoringu",
          autoRefreshLabel: "Auto refresh runtime (5s)",
          refresh: "Odswiez",
          sessionStatusLabel: "Status sesji",
          sessionStatusAll: "ALL",
          symbolFilterLabel: "Filtr symbolu (opcjonalnie)",
          symbolFilterPlaceholder: "np. BTCUSDT",
          symbolFilterHint: "Podpowiedz: wpisz np. BTCUSDT i nacisnij Enter, aby zawezic wszystkie sekcje monitoringu.",
          applyFilter: "Zastosuj",
          clearFilter: "Wyczysc",
          activeFilterLabel: "Aktywny filtr",
          none: "brak",
          autoRefreshAggregate: "Auto-refresh aktywny dla widoku zbiorczego.",
          autoRefreshCurrentSession: "Auto-refresh aktywny dla biezacej sesji.",
          autoRefreshSelectedSession: "Auto-refresh aktywny dla wybranej sesji.",
          advancedOptions: "Opcje zaawansowane",
          botManualLabel: "Bot (manualny wybor)",
          viewLabel: "Widok",
          viewAggregate: "Zbiorczy (domyslny)",
          viewSession: "Sesja (zaawansowany)",
          sessionLabel: "Sesja",
          noSessionsOption: "Brak sesji",
          scopeLabel: "Zakres",
          scopeAllSessions: "Wszystkie sesje ({count})",
          quickNavTitle: "Szybka nawigacja runtime",
          quickNavNow: "1. Teraz",
          quickNavHistory: "2. Historia",
          quickNavFuture: "3. Co bedzie",
          quickNavDescription:
            "Przejdz bezposrednio do sekcji operacyjnej: otwarte pozycje, historia wykonania i live-check sygnalow.",
          loadingSessions: "Ladowanie sesji runtime",
          loadErrorTitle: "Nie udalo sie pobrac monitoringu",
          emptySessionsTitle: "Brak sesji runtime",
          emptySessionsDescription:
            "Bot nie uruchomil jeszcze sesji monitoringu albo filtr statusu nic nie zwrocil. Upewnij sie, ze dziala worker execution + market-stream.",
          sessionModeBadge: "Mode: {mode}",
          sessionsBadge: "Sesje: {count}",
          sessionIdBadge: "Session ID: {id}",
          startLabel: "Start:",
          endLabel: "Koniec:",
          heartbeatLabel: "Heartbeat:",
          durationLabel: "Czas:",
          checklist: {
            title: "Checklist operatora",
            summary: "{ok}/{total} OK",
            ok: "OK",
            check: "SPRAWDZ",
            sessionActive: "Sesja aktywna",
            heartbeatFresh: "Heartbeat swiezy",
            positionData: "Dane pozycji",
            openCount: "{count} open",
            signalData: "Dane sygnalow",
            noSessionErrors: "Brak bledow sesji",
            reviewRequired: "wymaga sprawdzenia",
            none: "brak",
          },
          loadingSessionData: "Ladowanie danych sesji",
          nowTitle: "Co jest teraz",
          openPositionsLabel: "Pozycje otwarte:",
          openOrdersLabel: "Zlecenia otwarte:",
          openPnlLabel: "Open PnL:",
          wasTitle: "Co bylo",
          closedTradesLabel: "Trade'y zamkniete:",
          winRateLabel: "Win rate:",
          realizedPnlLabel: "Realized PnL:",
          futureTitle: "Co bedzie",
          trackedSymbolsLabel: "Sledzone symbole:",
          signalsLabel: "Sygnaly:",
          dcaLabel: "DCA:",
          feesLabel: "Fees:",
          operatorCheckTitle: "Szybka kontrola operatora",
          heartbeatLagLabel: "Heartbeat lag",
          lastSignalLabel: "Ostatni sygnal",
          lastTradeLabel: "Ostatni trade",
          openPositionsOrdersLabel: "Otwarte pozycje / zlecenia",
          sections: {
            nowOpenPositionsTitle: "1. Teraz - otwarte pozycje",
            nowOpenPositionsDescription: "Natychmiastowa kontrola tego, co jest aktywne w tej chwili.",
            nowOpenOrdersTitle: "Teraz - otwarte zlecenia",
            historyPositionsTitle: "2. Historia - pozycje",
            historyPositionsDescription: "Weryfikacja tego, co juz sie wydarzylo: wynik, tempo i jakosc wykonania.",
            historyTradesTitle: "Historia - log operacyjny trade'ow",
            futureSignalsTitle: "3. Co bedzie - live check sygnalow",
            futureSignalsDescription: "Szybka ocena, ktory symbol ma sygnal LONG/SHORT/EXIT lub brak sygnalu.",
          },
          notionalLabel: "Notional",
          marginLabel: "Margin",
          marginInitLabel: "Margin/init",
          activeCount: "{count} / {total} aktywne",
          table: {
            timeOpened: "Czas otwarcia",
            symbol: "Symbol",
            side: "Side",
            qty: "Qty",
            entry: "Entry",
            mark: "Mark",
            exit: "Exit",
            price: "Price",
            margin: "Margin",
            fees: "Fees",
            fee: "Fee",
            feePct: "Fee %",
            openPnl: "Open PnL",
            openPct: "Open %",
            realizedPnl: "Realized PnL",
            pnlPct: "PnL %",
            roiMarginPct: "ROI % (margin)",
            cumulativePnl: "Skumulowany PnL",
            dca: "DCA",
            signals: "Signals",
            lse: "L/S/E",
            closed: "Closed",
            wl: "W/L",
            openQty: "Open qty",
            origin: "Origin",
            order: "Order",
            position: "Position",
            lastTrade: "Last trade",
            slTtp: "TTP",
            slTsl: "TSL",
            status: "Status",
            type: "Type",
            filled: "Filled",
            stop: "Stop",
            submitted: "Submitted",
            open: "Otwarcie",
            close: "Zamkniecie",
            duration: "Czas",
            time: "Czas",
            action: "Action",
            signal: "Sygnal",
            signalTime: "Czas sygnalu",
          },
          emptyOpenPositions: "Brak otwartych pozycji w tej sesji.",
          emptyOpenOrders: "Brak otwartych zlecen.",
          closedCount: "{count} / {total} zamkniete",
          recordsCount: "{count} / {total} rekordow",
          emptyClosedPositions: "Brak zamknietych pozycji w tej sesji.",
          emptyTrades: "Brak transakcji dla tej sesji i filtra.",
          symbolCount: "{count} / {total} symboli",
          sortLatestSignal: "Sort: najnowszy sygnal",
          neutral: "NEUTRAL",
          emptySignalData: "Brak danych live-check sygnalow dla tej sesji i filtra.",
          active: "ACTIVE",
          inactive: "INACTIVE",
        },
        assistant: {
          title: "Konfiguracja asystenta",
          description: "Konfiguracja glownego asystenta i 4 slotow subagentow per bot.",
          emptyTitle: "Brak botow",
          emptyDescription: "Utworz najpierw bota, aby skonfigurowac Assistant.",
          botLabel: "Bot",
          loading: "Ladowanie konfiguracji asystenta",
          mainEnabledLabel: "Main enabled",
          mandateLabel: "Mandate",
          mandatePlaceholder: "Trade only with clear risk-adjusted edge",
          modelProfileLabel: "Model profile",
          safetyModeLabel: "Safety mode",
          mainLatencyLabel: "Main latency (ms)",
          saving: "Zapisywanie...",
          saveMain: "Zapisz main config",
          subagentSlotTitle: "Subagent slot {slot}",
          enabledLabel: "Enabled",
          roleLabel: "Role",
          profileLabel: "Profile",
          timeoutLabel: "Timeout (ms)",
          safetyLabel: "Safety",
          saveSlot: "Zapisz slot",
          deleteSlot: "Usun slot",
          decisionTimelineTitle: "Decision Timeline (dry-run)",
          symbolLabel: "Symbol",
          intervalLabel: "Interval",
          running: "Uruchamianie...",
          runDryRun: "Uruchom dry-run",
          traceRequest: "Request",
          traceMode: "Mode",
          traceFinalDecision: "Final decision",
          traceReason: "Reason",
          traceTableSlot: "Slot",
          traceTableRole: "Role",
          traceTableStatus: "Status",
          traceTableLatency: "Latency (ms)",
          traceTableMessage: "Msg",
          toasts: {
            loadFailed: "Nie udalo sie pobrac konfiguracji asystenta",
            mainSaved: "Konfiguracja main asystenta zapisana",
            mainSaveFailed: "Nie udalo sie zapisac konfiguracji asystenta",
            slotSaved: "Slot {slot} zapisany",
            slotSaveFailed: "Nie udalo sie zapisac slotu subagenta",
            slotDeleted: "Slot {slot} usuniety",
            slotDeleteFailed: "Nie udalo sie usunac slotu subagenta",
            dryRunReady: "Assistant dry-run gotowy",
            dryRunFailed: "Nie udalo sie wykonac dry-run asystenta",
          },
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

export type TranslationKey =
  | NestedTranslationKey<TranslationSchema>
  | `dashboard.bots.${string}`;
