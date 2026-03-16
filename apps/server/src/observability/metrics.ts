type MetricsSnapshot = {
  http: {
    requestsTotal: number;
    status2xx: number;
    status4xx: number;
    status5xx: number;
    totalDurationMs: number;
    avgDurationMs: number;
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

  snapshot(): MetricsSnapshot {
    const avgDurationMs = this.requestsTotal > 0 ? this.totalDurationMs / this.requestsTotal : 0;
    return {
      http: {
        requestsTotal: this.requestsTotal,
        status2xx: this.status2xx,
        status4xx: this.status4xx,
        status5xx: this.status5xx,
        totalDurationMs: this.totalDurationMs,
        avgDurationMs,
      },
    };
  }
}

export const metricsStore = new InMemoryMetricsStore();

