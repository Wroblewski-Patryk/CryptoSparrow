import { prisma } from '../../prisma/client';
import { runtimeSignalLoop } from './runtimeSignalLoop.service';
import { getRuntimeTicker } from './runtimeTickerStore';

type RuntimeScanDeps = {
  listScanSymbols: () => Promise<string[]>;
  getTickerSnapshot: (symbol: string) => Promise<{
    symbol: string;
    lastPrice: number;
    priceChangePercent24h: number;
  } | null>;
  processTicker: (event: {
    type: 'ticker';
    symbol: string;
    eventTime: number;
    lastPrice: number;
    priceChangePercent24h: number;
  }) => Promise<void>;
  nowMs: () => number;
};

const parseEnvSymbols = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter((item) => item.length > 0);

const defaultDeps: RuntimeScanDeps = {
  listScanSymbols: async () => {
    const envSymbols = parseEnvSymbols(process.env.RUNTIME_SCAN_SYMBOLS);
    if (envSymbols.length > 0) return envSymbols;

    const positions = await prisma.position.findMany({
      where: { status: 'OPEN' },
      select: { symbol: true },
      distinct: ['symbol'],
    });
    return positions.map((position) => position.symbol.toUpperCase());
  },
  getTickerSnapshot: async (symbol) => {
    const ticker = getRuntimeTicker(symbol);
    if (!ticker) return null;
    return {
      symbol: ticker.symbol,
      lastPrice: ticker.lastPrice,
      priceChangePercent24h: ticker.priceChangePercent24h,
    };
  },
  processTicker: async (event) => {
    await runtimeSignalLoop.processTickerEvent(event);
  },
  nowMs: () => Date.now(),
};

const scanIntervalMs = Number.parseInt(process.env.RUNTIME_SCAN_INTERVAL_MS ?? '30000', 10);
const scanMaxSymbols = Number.parseInt(process.env.RUNTIME_SCAN_MAX_SYMBOLS ?? '25', 10);

export class RuntimeScanLoop {
  private timer: NodeJS.Timeout | null = null;
  private inFlight = false;

  constructor(private readonly deps: RuntimeScanDeps = defaultDeps) {}

  start() {
    if (this.timer) return;
    if (!Number.isFinite(scanIntervalMs) || scanIntervalMs <= 0) return;

    this.timer = setInterval(() => {
      void this.runOnce();
    }, scanIntervalMs);
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  async runOnce() {
    if (this.inFlight) return;
    this.inFlight = true;

    try {
      const symbols = (await this.deps.listScanSymbols()).slice(0, Math.max(scanMaxSymbols, 1));
      await Promise.all(
        symbols.map(async (symbol) => {
          const ticker = await this.deps.getTickerSnapshot(symbol);
          if (!ticker) return;
          await this.deps.processTicker({
            type: 'ticker',
            symbol: ticker.symbol,
            eventTime: this.deps.nowMs(),
            lastPrice: ticker.lastPrice,
            priceChangePercent24h: ticker.priceChangePercent24h,
          });
        })
      );
    } finally {
      this.inFlight = false;
    }
  }
}

export const runtimeScanLoop = new RuntimeScanLoop();
