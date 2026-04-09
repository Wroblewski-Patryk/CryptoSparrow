type BacktestRunWorker = (runId: string) => Promise<void>;

export class BacktestRunQueue {
  private readonly pending: string[] = [];
  private readonly pendingSet = new Set<string>();
  private draining = false;

  constructor(private readonly worker: BacktestRunWorker) {}

  enqueue(runId: string) {
    const normalizedId = runId.trim();
    if (!normalizedId) return;
    if (this.pendingSet.has(normalizedId)) return;
    this.pending.push(normalizedId);
    this.pendingSet.add(normalizedId);
    void this.drain();
  }

  private async drain() {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.pending.length > 0) {
        const runId = this.pending.shift();
        if (!runId) continue;
        this.pendingSet.delete(runId);
        try {
          await this.worker(runId);
        } catch (error) {
          // Keep queue alive even when a single run fails.
          console.error('BacktestRunQueue worker failed:', error);
        }
      }
    } finally {
      this.draining = false;
      if (this.pending.length > 0) {
        void this.drain();
      }
    }
  }
}
