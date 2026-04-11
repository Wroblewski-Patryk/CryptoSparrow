import { prisma } from '../../prisma/client';
import {
  fetchExchangeOpenOrdersSnapshotByApiKeyId,
  fetchExchangePositionsSnapshotByApiKeyId,
} from './positions.service';

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

type ExternalSnapshotOpenOrder = {
  exchangeOrderId: string | null;
  symbol: string;
  side: string | null;
  type: string | null;
  status: string | null;
  amount: number;
  filled: number;
  remaining: number | null;
  price: number | null;
  timestamp: string | null;
};

type ReconcileDeps = {
  listSyncedApiKeys: () => Promise<SyncedApiKey[]>;
  resolveOwnershipForApiKey: (input: {
    userId: string;
    apiKeyId: string;
    manageExternalPositions: boolean;
  }) => Promise<{
    status: 'OWNED' | 'UNOWNED' | 'AMBIGUOUS';
    botId: string | null;
    walletId: string | null;
  }>;
  fetchPositionsForApiKey: (
    apiKey: SyncedApiKey
  ) => Promise<{ positions: ExternalSnapshotPosition[] }>;
  fetchOpenOrdersForApiKey?: (
    apiKey: SyncedApiKey
  ) => Promise<ExternalSnapshotOpenOrder[]>;
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
      syncState: 'IN_SYNC' | 'DRIFT';
      botId: string | null;
      walletId: string | null;
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
    syncState: 'IN_SYNC' | 'DRIFT';
    botId: string | null;
    walletId: string | null;
    openedAt: Date;
  }) => Promise<void>;
  listOpenSyncedPositionsForApiKey: (input: {
    userId: string;
    apiKeyId: string;
  }) => Promise<Array<{ id: string; externalId: string | null }>>;
  closeStaleSyncedPosition: (positionId: string, closedAt: Date) => Promise<void>;
  upsertSyncedOpenOrder?: (input: {
    userId: string;
    exchangeOrderId: string;
    botId: string;
    walletId: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT' | 'TAKE_PROFIT' | 'TRAILING';
    status: 'OPEN' | 'PARTIALLY_FILLED';
    quantity: number;
    filledQuantity: number;
    price: number | null;
    submittedAt: Date | null;
  }) => Promise<void>;
  listOpenSyncedOrdersForOwner?: (input: {
    userId: string;
    botId: string;
    walletId: string;
  }) => Promise<Array<{ id: string; exchangeOrderId: string | null }>>;
  closeStaleSyncedOrder?: (orderId: string, closedAt: Date) => Promise<void>;
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

const toOrderSide = (side: string | null): 'BUY' | 'SELL' | null => {
  const normalized = (side ?? '').trim().toLowerCase();
  if (normalized === 'buy') return 'BUY';
  if (normalized === 'sell') return 'SELL';
  return null;
};

const toOrderType = (
  type: string | null
): 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT' | 'TAKE_PROFIT' | 'TRAILING' => {
  const normalized = (type ?? '').trim().toLowerCase();
  if (normalized.includes('market') && normalized.includes('stop')) return 'STOP';
  if (normalized.includes('stop') && normalized.includes('limit')) return 'STOP_LIMIT';
  if (normalized.includes('stop')) return 'STOP';
  if (normalized.includes('take') && normalized.includes('profit')) return 'TAKE_PROFIT';
  if (normalized.includes('trail')) return 'TRAILING';
  if (normalized.includes('market')) return 'MARKET';
  return 'LIMIT';
};

const toOpenOrderStatus = (status: string | null): 'OPEN' | 'PARTIALLY_FILLED' | null => {
  const normalized = (status ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('partial')) return 'PARTIALLY_FILLED';
  if (
    normalized.includes('open') ||
    normalized.includes('new') ||
    normalized.includes('working')
  ) {
    return 'OPEN';
  }
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
  resolveOwnershipForApiKey: async ({ userId, apiKeyId, manageExternalPositions }) => {
    if (!manageExternalPositions) {
      return {
        status: 'UNOWNED' as const,
        botId: null,
        walletId: null,
      };
    }

    const candidates = await prisma.bot.findMany({
      where: {
        userId,
        apiKeyId,
        mode: 'LIVE',
        exchange: 'BINANCE',
        marketType: 'FUTURES',
        isActive: true,
        liveOptIn: true,
      },
      select: {
        id: true,
        walletId: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    if (candidates.length === 1) {
      const owner = candidates[0];
      if (!owner.walletId) {
        return {
          status: 'UNOWNED' as const,
          botId: null,
          walletId: null,
        };
      }
      return {
        status: 'OWNED' as const,
        botId: owner.id,
        walletId: owner.walletId,
      };
    }

    if (candidates.length === 0) {
      return {
        status: 'UNOWNED' as const,
        botId: null,
        walletId: null,
      };
    }

    return {
      status: 'AMBIGUOUS' as const,
      botId: null,
      walletId: null,
    };
  },
  fetchPositionsForApiKey: async (apiKey) =>
    fetchExchangePositionsSnapshotByApiKeyId(apiKey.userId, apiKey.id),
  fetchOpenOrdersForApiKey: async (apiKey) => {
    const snapshot = await fetchExchangeOpenOrdersSnapshotByApiKeyId(apiKey.userId, apiKey.id);
    return snapshot.orders;
  },
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
        syncState: input.syncState,
        botId: input.botId,
        walletId: input.walletId,
        strategyId: null,
      },
    });
  },
  createSyncedPosition: async (input) => {
    await prisma.position.create({
      data: {
        userId: input.userId,
        botId: input.botId,
        walletId: input.walletId,
        strategyId: null,
        externalId: input.externalId,
        origin: 'EXCHANGE_SYNC',
        managementMode: input.managementMode,
        syncState: input.syncState,
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
  upsertSyncedOpenOrder: async (input) => {
    const existing = await prisma.order.findFirst({
      where: {
        userId: input.userId,
        exchangeOrderId: input.exchangeOrderId,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        origin: true,
      },
    });

    if (existing && existing.origin !== 'EXCHANGE_SYNC') {
      return;
    }

    const data = {
      botId: input.botId,
      walletId: input.walletId,
      strategyId: null,
      positionId: null,
      origin: 'EXCHANGE_SYNC' as const,
      managementMode: 'BOT_MANAGED' as const,
      syncState: 'IN_SYNC' as const,
      symbol: input.symbol,
      side: input.side,
      type: input.type,
      status: input.status,
      quantity: input.quantity,
      filledQuantity: input.filledQuantity,
      price: input.price,
      exchangeOrderId: input.exchangeOrderId,
      submittedAt: input.submittedAt,
      canceledAt: null,
    };

    if (existing) {
      await prisma.order.update({
        where: { id: existing.id },
        data,
      });
      return;
    }

    await prisma.order.create({
      data: {
        userId: input.userId,
        ...data,
      },
    });
  },
  listOpenSyncedOrdersForOwner: async ({ userId, botId, walletId }) =>
    prisma.order.findMany({
      where: {
        userId,
        botId,
        walletId,
        origin: 'EXCHANGE_SYNC',
        managementMode: 'BOT_MANAGED',
        status: { in: ['OPEN', 'PARTIALLY_FILLED', 'PENDING'] },
      },
      select: {
        id: true,
        exchangeOrderId: true,
      },
    }),
  closeStaleSyncedOrder: async (orderId, closedAt) => {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELED',
        canceledAt: closedAt,
        syncState: 'ORPHAN_LOCAL',
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
      const ownership = await deps.resolveOwnershipForApiKey({
        userId: apiKey.userId,
        apiKeyId: apiKey.id,
        manageExternalPositions: apiKey.manageExternalPositions,
      });
      const managedByBot = apiKey.manageExternalPositions && ownership.status === 'OWNED';
      const managementMode = managedByBot ? 'BOT_MANAGED' : 'MANUAL_MANAGED';
      const syncState = managedByBot || !apiKey.manageExternalPositions ? 'IN_SYNC' : 'DRIFT';

      if (apiKey.manageExternalPositions && ownership.status !== 'OWNED') {
        console.warn(
          `[LivePositionReconciliation] apiKey=${apiKey.id} user=${apiKey.userId} unresolved_takeover_owner=${ownership.status}`
        );
      }

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
            syncState,
            botId: ownership.botId,
            walletId: ownership.walletId,
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
            syncState,
            botId: ownership.botId,
            walletId: ownership.walletId,
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

      if (
        managedByBot &&
        ownership.botId &&
        ownership.walletId &&
        deps.fetchOpenOrdersForApiKey &&
        deps.upsertSyncedOpenOrder &&
        deps.listOpenSyncedOrdersForOwner &&
        deps.closeStaleSyncedOrder
      ) {
        const openOrders = await deps.fetchOpenOrdersForApiKey(apiKey);
        const seenOpenExchangeOrderIds = new Set<string>();

        for (const order of openOrders) {
          const exchangeOrderId = order.exchangeOrderId?.trim();
          if (!exchangeOrderId) continue;
          const side = toOrderSide(order.side);
          const status = toOpenOrderStatus(order.status);
          if (!side || !status) continue;

          const normalizedSymbol = normalizeSymbol(order.symbol);
          if (!normalizedSymbol) continue;

          const quantity = Number.isFinite(order.amount) ? Math.max(0, order.amount) : 0;
          if (quantity <= 0) continue;
          const filledQuantity = Number.isFinite(order.filled)
            ? Math.max(0, Math.min(quantity, order.filled))
            : 0;
          const submittedAt =
            typeof order.timestamp === 'string' && order.timestamp.length > 0
              ? new Date(order.timestamp)
              : null;

          seenOpenExchangeOrderIds.add(exchangeOrderId);

          await deps.upsertSyncedOpenOrder({
            userId: apiKey.userId,
            exchangeOrderId,
            botId: ownership.botId,
            walletId: ownership.walletId,
            symbol: normalizedSymbol,
            side,
            type: toOrderType(order.type),
            status,
            quantity,
            filledQuantity,
            price: typeof order.price === 'number' && Number.isFinite(order.price) ? order.price : null,
            submittedAt,
          });
        }

        const openSyncedOrders = await deps.listOpenSyncedOrdersForOwner({
          userId: apiKey.userId,
          botId: ownership.botId,
          walletId: ownership.walletId,
        });
        for (const openSyncedOrder of openSyncedOrders) {
          const exchangeOrderId = openSyncedOrder.exchangeOrderId?.trim();
          if (!exchangeOrderId || seenOpenExchangeOrderIds.has(exchangeOrderId)) continue;
          await deps.closeStaleSyncedOrder(openSyncedOrder.id, deps.now());
        }
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
