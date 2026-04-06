import { metricsStore } from './metrics';

export type AlertSeverity = 'SEV-1' | 'SEV-2';

export type RuntimeAlert = {
  code: string;
  severity: AlertSeverity;
  message: string;
};

type AlertInput = {
  nowMs: number;
  marketDataLastAtMs: number | null;
  workerHeartbeatLastAtMs: number | null;
};

const staleThresholdMs = 2 * 60 * 1000;
const heartbeatThresholdMs = 60 * 1000;
const runtimeSignalLagStaleThresholdMs = 90 * 1000;
const runtimeRestartWarnThreshold = 3;
const runtimeRestartCriticalThreshold = 6;
const runtimeReconciliationPendingWarnThreshold = 2;
const runtimeReconciliationPendingCriticalThreshold = 5;
const runtimeReconciliationDelayWarnThresholdMs = 3 * 60 * 1000;
const runtimeReconciliationDelayCriticalThresholdMs = 10 * 60 * 1000;

export const evaluateRuntimeAlerts = (input: AlertInput): RuntimeAlert[] => {
  const alerts: RuntimeAlert[] = [];
  const snapshot = metricsStore.snapshot();

  if (snapshot.exchange.orderFailures >= 3) {
    alerts.push({
      code: 'exchange_live_order_failures_spike',
      severity: 'SEV-2',
      message: `Detected ${snapshot.exchange.orderFailures} exchange order failures.`,
    });
  }

  if (snapshot.worker.queueLag.marketData > 100) {
    alerts.push({
      code: 'market_data_queue_lag_high',
      severity: 'SEV-2',
      message: `Market-data queue lag is ${snapshot.worker.queueLag.marketData}.`,
    });
  }

  if (
    typeof input.marketDataLastAtMs === 'number' &&
    input.nowMs - input.marketDataLastAtMs > staleThresholdMs
  ) {
    alerts.push({
      code: 'market_data_staleness',
      severity: 'SEV-2',
      message: 'Market data stream appears stale.',
    });
  }

  if (
    typeof input.workerHeartbeatLastAtMs === 'number' &&
    input.nowMs - input.workerHeartbeatLastAtMs > heartbeatThresholdMs
  ) {
    alerts.push({
      code: 'worker_heartbeat_missing',
      severity: 'SEV-1',
      message: 'Worker heartbeat is missing beyond threshold.',
    });
  }

  if (snapshot.runtime.signalLag.lastMs >= runtimeSignalLagStaleThresholdMs) {
    alerts.push({
      code: 'runtime_signal_lag_stale',
      severity: 'SEV-2',
      message: `Runtime signal lag is ${snapshot.runtime.signalLag.lastMs}ms (threshold ${runtimeSignalLagStaleThresholdMs}ms).`,
    });
  }

  if (snapshot.runtime.restarts.total >= runtimeRestartWarnThreshold) {
    alerts.push({
      code: 'runtime_restarts_repeated',
      severity:
        snapshot.runtime.restarts.total >= runtimeRestartCriticalThreshold ? 'SEV-1' : 'SEV-2',
      message: `Runtime restart count reached ${snapshot.runtime.restarts.total}.`,
    });
  }

  const reconciliationPending = snapshot.runtime.reconciliation.pending;
  const reconciliationMaxDelayMs = snapshot.runtime.reconciliation.maxDelayMs;
  const reconciliationDrift =
    reconciliationPending >= runtimeReconciliationPendingWarnThreshold ||
    reconciliationMaxDelayMs >= runtimeReconciliationDelayWarnThresholdMs;
  if (reconciliationDrift) {
    alerts.push({
      code: 'runtime_reconciliation_drift',
      severity:
        reconciliationPending >= runtimeReconciliationPendingCriticalThreshold ||
        reconciliationMaxDelayMs >= runtimeReconciliationDelayCriticalThresholdMs
          ? 'SEV-1'
          : 'SEV-2',
      message: `Runtime reconciliation drift detected (pending=${reconciliationPending}, maxDelayMs=${reconciliationMaxDelayMs}).`,
    });
  }

  return alerts;
};
