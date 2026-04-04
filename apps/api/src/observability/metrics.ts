type MetricsSnapshot = {
  http: {
    requestsTotal: number;
    status2xx: number;
    status4xx: number;
    status5xx: number;
    totalDurationMs: number;
    avgDurationMs: number;
  };
  exchange: {
    orderAttempts: number;
    orderRetries: number;
    orderFailures: number;
  };
  worker: {
    queueLag: {
      marketData: number;
      backtest: number;
      execution: number;
    };
  };
  runtime: {
    groupEvaluation: {
      total: number;
      totalDurationMs: number;
      avgDurationMs: number;
    };
    mergeOutcomes: {
      long: number;
      short: number;
      exit: number;
      noTrade: number;
    };
    signalLag: {
      total: number;
      lastMs: number;
      maxMs: number;
      totalLagMs: number;
      avgLagMs: number;
    };
    restarts: {
      total: number;
      noEvent: number;
      noHeartbeat: number;
    };
    reconciliation: {
      total: number;
      pending: number;
      totalDelayMs: number;
      avgDelayMs: number;
      maxDelayMs: number;
    };
    executionErrors: Record<string, number>;
  };
  assistant: {
    subagentTimeouts: number;
  };
};

type HttpMetricInput = {
  statusCode: number;
  durationMs: number;
};

class InMemoryMetricsStore {
  private requestsTotal = 0;
  private status2xx = 0;
  private status4xx = 0;
  private status5xx = 0;
  private totalDurationMs = 0;
  private exchangeOrderAttempts = 0;
  private exchangeOrderRetries = 0;
  private exchangeOrderFailures = 0;
  private marketDataQueueLag = 0;
  private backtestQueueLag = 0;
  private executionQueueLag = 0;
  private runtimeGroupEvaluations = 0;
  private runtimeGroupTotalDurationMs = 0;
  private runtimeMergeLong = 0;
  private runtimeMergeShort = 0;
  private runtimeMergeExit = 0;
  private runtimeMergeNoTrade = 0;
  private runtimeSignalLagTotal = 0;
  private runtimeSignalLagLastMs = 0;
  private runtimeSignalLagMaxMs = 0;
  private runtimeSignalLagTotalMs = 0;
  private runtimeRestartTotal = 0;
  private runtimeRestartNoEvent = 0;
  private runtimeRestartNoHeartbeat = 0;
  private runtimeReconciliationTotal = 0;
  private runtimeReconciliationPending = 0;
  private runtimeReconciliationTotalDelayMs = 0;
  private runtimeReconciliationMaxDelayMs = 0;
  private readonly runtimeExecutionErrors = new Map<string, number>();
  private assistantSubagentTimeouts = 0;

  recordHttp(input: HttpMetricInput) {
    this.requestsTotal += 1;
    this.totalDurationMs += Math.max(0, input.durationMs);

    if (input.statusCode >= 200 && input.statusCode < 300) {
      this.status2xx += 1;
      return;
    }
    if (input.statusCode >= 400 && input.statusCode < 500) {
      this.status4xx += 1;
      return;
    }
    if (input.statusCode >= 500) {
      this.status5xx += 1;
    }
  }

  recordExchangeOrderAttempt() {
    this.exchangeOrderAttempts += 1;
  }

  recordExchangeOrderRetry() {
    this.exchangeOrderRetries += 1;
  }

  recordExchangeOrderFailure() {
    this.exchangeOrderFailures += 1;
  }

  setWorkerQueueLag(kind: 'marketData' | 'backtest' | 'execution', lag: number) {
    const value = Number.isFinite(lag) ? Math.max(0, lag) : 0;
    if (kind === 'marketData') this.marketDataQueueLag = value;
    if (kind === 'backtest') this.backtestQueueLag = value;
    if (kind === 'execution') this.executionQueueLag = value;
  }

  recordRuntimeGroupEvaluation(durationMs: number) {
    this.runtimeGroupEvaluations += 1;
    this.runtimeGroupTotalDurationMs += Math.max(0, durationMs);
  }

  recordRuntimeMergeOutcome(outcome: 'LONG' | 'SHORT' | 'EXIT' | 'NO_TRADE') {
    if (outcome === 'LONG') this.runtimeMergeLong += 1;
    if (outcome === 'SHORT') this.runtimeMergeShort += 1;
    if (outcome === 'EXIT') this.runtimeMergeExit += 1;
    if (outcome === 'NO_TRADE') this.runtimeMergeNoTrade += 1;
  }

  recordRuntimeSignalLag(lagMs: number) {
    const value = Number.isFinite(lagMs) ? Math.max(0, lagMs) : 0;
    this.runtimeSignalLagTotal += 1;
    this.runtimeSignalLagLastMs = value;
    this.runtimeSignalLagTotalMs += value;
    this.runtimeSignalLagMaxMs = Math.max(this.runtimeSignalLagMaxMs, value);
  }

  recordRuntimeRestart(reason: 'runtime_stall_no_event' | 'runtime_stall_no_heartbeat') {
    this.runtimeRestartTotal += 1;
    if (reason === 'runtime_stall_no_event') this.runtimeRestartNoEvent += 1;
    if (reason === 'runtime_stall_no_heartbeat') this.runtimeRestartNoHeartbeat += 1;
  }

  recordRuntimeReconciliationDelay(delayMs: number, pending: boolean) {
    const value = Number.isFinite(delayMs) ? Math.max(0, delayMs) : 0;
    this.runtimeReconciliationTotal += 1;
    this.runtimeReconciliationTotalDelayMs += value;
    this.runtimeReconciliationMaxDelayMs = Math.max(this.runtimeReconciliationMaxDelayMs, value);
    if (pending) this.runtimeReconciliationPending += 1;
  }

  recordRuntimeExecutionError(errorClass: string) {
    const key = this.normalizeRuntimeErrorClass(errorClass);
    const current = this.runtimeExecutionErrors.get(key) ?? 0;
    this.runtimeExecutionErrors.set(key, current + 1);
  }

  private normalizeRuntimeErrorClass(errorClass: string) {
    const normalized = String(errorClass ?? 'unknown')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_:-]+/g, '_')
      .slice(0, 64);
    return normalized.length > 0 ? normalized : 'unknown';
  }

  recordAssistantSubagentTimeout() {
    this.assistantSubagentTimeouts += 1;
  }

  snapshot(): MetricsSnapshot {
    const avgDurationMs = this.requestsTotal > 0 ? this.totalDurationMs / this.requestsTotal : 0;
    const runtimeAvgDurationMs =
      this.runtimeGroupEvaluations > 0
        ? this.runtimeGroupTotalDurationMs / this.runtimeGroupEvaluations
        : 0;
    const runtimeAvgLagMs =
      this.runtimeSignalLagTotal > 0 ? this.runtimeSignalLagTotalMs / this.runtimeSignalLagTotal : 0;
    const runtimeReconciliationAvgMs =
      this.runtimeReconciliationTotal > 0
        ? this.runtimeReconciliationTotalDelayMs / this.runtimeReconciliationTotal
        : 0;
    return {
      http: {
        requestsTotal: this.requestsTotal,
        status2xx: this.status2xx,
        status4xx: this.status4xx,
        status5xx: this.status5xx,
        totalDurationMs: this.totalDurationMs,
        avgDurationMs,
      },
      exchange: {
        orderAttempts: this.exchangeOrderAttempts,
        orderRetries: this.exchangeOrderRetries,
        orderFailures: this.exchangeOrderFailures,
      },
      worker: {
        queueLag: {
          marketData: this.marketDataQueueLag,
          backtest: this.backtestQueueLag,
          execution: this.executionQueueLag,
        },
      },
      runtime: {
        groupEvaluation: {
          total: this.runtimeGroupEvaluations,
          totalDurationMs: this.runtimeGroupTotalDurationMs,
          avgDurationMs: runtimeAvgDurationMs,
        },
        mergeOutcomes: {
          long: this.runtimeMergeLong,
          short: this.runtimeMergeShort,
          exit: this.runtimeMergeExit,
          noTrade: this.runtimeMergeNoTrade,
        },
        signalLag: {
          total: this.runtimeSignalLagTotal,
          lastMs: this.runtimeSignalLagLastMs,
          maxMs: this.runtimeSignalLagMaxMs,
          totalLagMs: this.runtimeSignalLagTotalMs,
          avgLagMs: runtimeAvgLagMs,
        },
        restarts: {
          total: this.runtimeRestartTotal,
          noEvent: this.runtimeRestartNoEvent,
          noHeartbeat: this.runtimeRestartNoHeartbeat,
        },
        reconciliation: {
          total: this.runtimeReconciliationTotal,
          pending: this.runtimeReconciliationPending,
          totalDelayMs: this.runtimeReconciliationTotalDelayMs,
          avgDelayMs: runtimeReconciliationAvgMs,
          maxDelayMs: this.runtimeReconciliationMaxDelayMs,
        },
        executionErrors: Object.fromEntries(this.runtimeExecutionErrors.entries()),
      },
      assistant: {
        subagentTimeouts: this.assistantSubagentTimeouts,
      },
    };
  }
}

export const metricsStore = new InMemoryMetricsStore();
