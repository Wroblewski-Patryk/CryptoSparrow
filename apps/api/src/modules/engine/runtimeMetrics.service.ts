import { metricsStore } from '../../observability/metrics';

type RuntimeMetricsDeps = {
  nowMs: () => number;
};

const defaultDeps: RuntimeMetricsDeps = {
  nowMs: () => Date.now(),
};

export class RuntimeMetricsService {
  constructor(private readonly deps: RuntimeMetricsDeps = defaultDeps) {}

  async measureListActiveBots<T>(run: () => Promise<T>) {
    const startedAt = this.deps.nowMs();
    try {
      return await run();
    } finally {
      metricsStore.recordRuntimeListActiveBots(this.deps.nowMs() - startedAt);
    }
  }

  async measurePreTradeLatency<T>(run: () => Promise<T>) {
    const startedAt = this.deps.nowMs();
    try {
      return await run();
    } finally {
      metricsStore.recordRuntimePreTradeLatency(this.deps.nowMs() - startedAt);
    }
  }

  recordEligibleGroupsCount(count: number) {
    metricsStore.recordRuntimeEligibleGroupsCount(count);
  }

  recordTouchSessionWrite() {
    metricsStore.recordRuntimeTouchSessionWrite();
  }

  recordSymbolStatsWrite() {
    metricsStore.recordRuntimeSymbolStatsWrite();
  }
}

export const runtimeMetricsService = new RuntimeMetricsService();
