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

  recordAssistantSubagentTimeout() {
    this.assistantSubagentTimeouts += 1;
  }

  snapshot(): MetricsSnapshot {
    const avgDurationMs = this.requestsTotal > 0 ? this.totalDurationMs / this.requestsTotal : 0;
    const runtimeAvgDurationMs =
      this.runtimeGroupEvaluations > 0
        ? this.runtimeGroupTotalDurationMs / this.runtimeGroupEvaluations
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
      },
      assistant: {
        subagentTimeouts: this.assistantSubagentTimeouts,
      },
    };
  }
}

export const metricsStore = new InMemoryMetricsStore();
