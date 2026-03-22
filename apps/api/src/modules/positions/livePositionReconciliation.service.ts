import { prisma } from '../../prisma/client';

type ReconciliationStatus = {
  running: boolean;
  iterations: number;
  lastRunAt: string | null;
  lastDurationMs: number | null;
  lastError: string | null;
  openPositionsSeen: number;
};

type ReconcileFn = () => Promise<{ openPositionsSeen: number }>;

const defaultReconcile: ReconcileFn = async () => {
  const openPositionsSeen = await prisma.position.count({
    where: { status: 'OPEN' },
  });
  return { openPositionsSeen };
};

export class LivePositionReconciliationLoop {
  private timer: NodeJS.Timeout | null = null;
  private status: ReconciliationStatus = {
    running: false,
    iterations: 0,
    lastRunAt: null,
    lastDurationMs: null,
    lastError: null,
    openPositionsSeen: 0,
  };

  constructor(
    private readonly reconcileFn: ReconcileFn = defaultReconcile,
    private readonly intervalMs: number = 15_000
  ) {}

  start() {
    if (this.timer) return;
    this.status.running = true;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.intervalMs);
    void this.runOnce();
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    this.status.running = false;
  }

  getStatus() {
    return { ...this.status };
  }

  async runOnce() {
    const startedAt = Date.now();
    try {
      const result = await this.reconcileFn();
      this.status.iterations += 1;
      this.status.lastRunAt = new Date().toISOString();
      this.status.lastDurationMs = Date.now() - startedAt;
      this.status.lastError = null;
      this.status.openPositionsSeen = result.openPositionsSeen;
      process.env.POSITIONS_RECON_LAST_RUN_AT = this.status.lastRunAt;
    } catch (error) {
      this.status.lastRunAt = new Date().toISOString();
      this.status.lastDurationMs = Date.now() - startedAt;
      this.status.lastError = error instanceof Error ? error.message : 'unknown_error';
    }
  }
}

export const livePositionReconciliationLoop = new LivePositionReconciliationLoop();
