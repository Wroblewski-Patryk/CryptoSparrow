import { OhlcvCandle, OhlcvRequest } from '../market-data/marketData.types';

export interface PaperRuntimeMarketDataService {
  ingestOHLCV(input: OhlcvRequest, forceRefresh?: boolean): Promise<OhlcvCandle[]>;
}

export type PaperRuntimeTask = {
  symbol: string;
  timeframe: string;
  limit?: number;
  onTick: (candles: OhlcvCandle[]) => Promise<void> | void;
};

export type PaperRuntimeConfig = {
  pollIntervalMs: number;
  tasks: PaperRuntimeTask[];
};

export class PaperRuntimeService {
  private timer: NodeJS.Timeout | null = null;
  private inFlightTaskKeys = new Set<string>();

  constructor(private readonly marketDataService: PaperRuntimeMarketDataService) {}

  isRunning() {
    return this.timer !== null;
  }

  start(config: PaperRuntimeConfig) {
    if (this.timer) return;
    if (config.tasks.length === 0) return;

    this.timer = setInterval(() => {
      void this.tick(config.tasks);
    }, config.pollIntervalMs);
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    this.inFlightTaskKeys.clear();
  }

  async runOnce(tasks: PaperRuntimeTask[]) {
    await this.tick(tasks);
  }

  private async tick(tasks: PaperRuntimeTask[]) {
    await Promise.all(tasks.map((task) => this.processTask(task)));
  }

  private async processTask(task: PaperRuntimeTask) {
    const taskKey = `${task.symbol.toUpperCase()}|${task.timeframe}`;
    if (this.inFlightTaskKeys.has(taskKey)) return;

    this.inFlightTaskKeys.add(taskKey);

    try {
      const candles = await this.marketDataService.ingestOHLCV(
        {
          symbol: task.symbol,
          timeframe: task.timeframe,
          limit: task.limit ?? 200,
        },
        true
      );

      await task.onTick(candles);
    } catch {
      // Runtime loop should continue after transient data/handler errors.
    } finally {
      this.inFlightTaskKeys.delete(taskKey);
    }
  }
}
