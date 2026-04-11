import { prisma } from '../../prisma/client';
import { fetchExchangePositionsSnapshotByApiKeyId } from './positions.service';

type ReconciliationStatus = {
  running: boolean;
  iterations: number;
  lastRunAt: string | null;
  lastDurationMs: number | null;
  lastError: string | null;
  openPositionsSeen: number;
};

type ReconcileFn = () => Promise<{ openPositionsSeen: number }>;

type SyncedApiKey = {
  id: string;
  userId: string;
  manageExternalPositions: boolean;
};

type ExternalSnapshotPosition = {
  symbol: string;
  side: string | null;
  contracts: number;
  entryPrice: number | null;
  markPrice: number | null;
  unrealizedPnl: number | null;
  leverage: number | null;
  timestamp: string | null;
};

type ReconcileDeps = {
  listSyncedApiKeys: () => Promise<SyncedApiKey[]>;
  fetchPositionsForApiKey: (
    apiKey: SyncedApiKey
  ) => Promise<{ positions: ExternalSnapshotPosition[] }>;
  findOpenSyncedPositionByExternalId: (input: {
    userId: string;
    externalId: string;
  }) => Promise<{ id: string } | null>;
  updateSyncedPosition: (
    positionId: string,
    input: {
      symbol: string;
      side: 'LONG' | 'SHORT';
      quantity: number;
      entryPrice: number;
      unrealizedPnl: number | null;
      leverage: number;
      managementMode: 'BOT_MANAGED' | 'MANUAL_MANAGED';
    }
  ) => Promise<void>;
  createSyncedPosition: (input: {
    userId: string;
    externalId: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    quantity: number;
    entryPrice: number;
    unrealizedPnl: number | null;
    leverage: number;
    managementMode: 'BOT_MANAGED' | 'MANUAL_MANAGED';
    openedAt: Date;
  }) => Promise<void>;
  listOpenSyncedPositionsForApiKey: (input: {
    userId: string;
    apiKeyId: string;
  }) => Promise<Array<{ id: string; externalId: string | null }>>;
  closeStaleSyncedPosition: (positionId: string, closedAt: Date) => Promise<void>;
  now: () => Date;
};

const normalizeSymbol = (symbol: string) => {
  const trimmed = symbol.trim().toUpperCase();
  if (!trimmed) return '';
  if (trimmed.includes('/') && trimmed.includes(':')) {
    const [base, quoteAndSettle] = trimmed.split('/');
    const [, settle] = quoteAndSettle.split(':');
    if (base && settle) return `${base}${settle}`;
  }
  if (trimmed.includes('/')) {
    const [base, quote] = trimmed.split('/');
    if (base && quote) return `${base}${quote}`;
  }
  return trimmed.replace(/[/:]/g, '');
};

const toPositionSide = (
  side: string | null,
  contracts: number
): 'LONG' | 'SHORT' | null => {
  const normalized = (side ?? '').trim().toLowerCase();
  if (normalized === 'long') return 'LONG';
  if (normalized === 'short') return 'SHORT';
  if (contracts > 0) return 'LONG';
  if (contracts < 0) return 'SHORT';
  return null;
};

const defaultDeps: ReconcileDeps = {
  listSyncedApiKeys: async () => {
    return prisma.apiKey.findMany({
      where: {
        exchange: 'BINANCE',
        syncExternalPositions: true,
      },
      select: {
        id: true,
        userId: true,
        manageExternalPositions: true,
      },
      orderBy: [{ userId: 'asc' }, { updatedAt: 'desc' }],
    });
  },
  fetchPositionsForApiKey: async (apiKey) =>
    fetchExchangePositionsSnapshotByApiKeyId(apiKey.userId, apiKey.id),
  findOpenSyncedPositionByExternalId: async ({ userId, externalId }) =>
    prisma.position.findFirst({
      where: { userId, externalId, status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
      select: { id: true },
    }),
  updateSyncedPosition: async (positionId, input) => {
    await prisma.position.update({
      where: { id: positionId },
      data: {
        symbol: input.symbol,
        side: input.side,
        quantity: input.quantity,
        entryPrice: input.entryPrice,
        unrealizedPnl: input.unrealizedPnl,
        leverage: input.leverage,
        managementMode: input.managementMode,
        origin: 'EXCHANGE_SYNC',
        syncState: 'IN_SYNC',
        botId: null,
        strategyId: null,
      },
    });
  },
  createSyncedPosition: async (input) => {
    await prisma.position.create({
      data: {
        userId: input.userId,
        botId: null,
        strategyId: null,
        externalId: input.externalId,
        origin: 'EXCHANGE_SYNC',
        managementMode: input.managementMode,
        syncState: 'IN_SYNC',
        symbol: input.symbol,
        side: input.side,
        status: 'OPEN',
        entryPrice: input.entryPrice,
        quantity: input.quantity,
        leverage: input.leverage,
        unrealizedPnl: input.unrealizedPnl,
        openedAt: input.openedAt,
      },
    });
  },
  listOpenSyncedPositionsForApiKey: async ({ userId, apiKeyId }) =>
    prisma.position.findMany({
      where: {
        userId,
        origin: 'EXCHANGE_SYNC',
        status: 'OPEN',
        externalId: { startsWith: `${apiKeyId}:` },
      },
      select: { id: true, externalId: true },
    }),
  closeStaleSyncedPosition: async (positionId, closedAt) => {
    await prisma.position.update({
      where: { id: positionId },
      data: {
        status: 'CLOSED',
        closedAt,
        syncState: 'ORPHAN_LOCAL',
        unrealizedPnl: 0,
      },
    });
  },
  now: () => new Date(),
};

export const reconcileExternalPositionsFromExchange = async (
  deps: ReconcileDeps = defaultDeps
): Promise<{ openPositionsSeen: number }> => {
  const apiKeys = await deps.listSyncedApiKeys();
  let openPositionsSeen = 0;

  for (const apiKey of apiKeys) {
    try {
      const snapshot = await deps.fetchPositionsForApiKey(apiKey);
      const seenExternalIds = new Set<string>();
      const openedAtFallback = deps.now();
      const managementMode = apiKey.manageExternalPositions ? 'BOT_MANAGED' : 'MANUAL_MANAGED';

      for (const position of snapshot.positions) {
        const size = Math.abs(position.contracts ?? 0);
        if (size <= 0) continue;
        const side = toPositionSide(position.side, position.contracts);
        if (!side) continue;

        const normalizedSymbol = normalizeSymbol(position.symbol);
        if (!normalizedSymbol) continue;

        openPositionsSeen += 1;
        const externalId = `${apiKey.id}:${normalizedSymbol}:${side}`;
        seenExternalIds.add(externalId);

        const existing = await deps.findOpenSyncedPositionByExternalId({
          userId: apiKey.userId,
          externalId,
        });

        if (existing) {
          await deps.updateSyncedPosition(existing.id, {
            symbol: normalizedSymbol,
            side,
            quantity: size,
            entryPrice: position.entryPrice ?? position.markPrice ?? 0,
            unrealizedPnl: position.unrealizedPnl ?? null,
            leverage: Math.max(1, Math.floor(position.leverage ?? 1)),
            managementMode,
          });
        } else {
          const openedAt = position.timestamp ? new Date(position.timestamp) : openedAtFallback;
          await deps.createSyncedPosition({
            userId: apiKey.userId,
            externalId,
            symbol: normalizedSymbol,
            side,
            quantity: size,
            entryPrice: position.entryPrice ?? position.markPrice ?? 0,
            unrealizedPnl: position.unrealizedPnl ?? null,
            leverage: Math.max(1, Math.floor(position.leverage ?? 1)),
            managementMode,
            openedAt,
          });
        }
      }

      const currentOpen = await deps.listOpenSyncedPositionsForApiKey({
        userId: apiKey.userId,
        apiKeyId: apiKey.id,
      });

      for (const stale of currentOpen) {
        if (stale.externalId && seenExternalIds.has(stale.externalId)) continue;
        await deps.closeStaleSyncedPosition(stale.id, deps.now());
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'unknown_error';
      console.error(
        `[LivePositionReconciliation] apiKey=${apiKey.id} user=${apiKey.userId} failed: ${errorMessage}`
      );
    }
  }

  return { openPositionsSeen };
};

const defaultReconcile: ReconcileFn = async () => reconcileExternalPositionsFromExchange();

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
