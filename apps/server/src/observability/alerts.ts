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

  return alerts;
};

