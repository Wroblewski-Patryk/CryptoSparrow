import { createClient } from 'redis';
import { PositionManagementState } from './positionManagement.types';

type RedisClient = ReturnType<typeof createClient>;

export type PersistedRuntimePositionState = Pick<
  PositionManagementState,
  | 'quantity'
  | 'averageEntryPrice'
  | 'currentAdds'
  | 'trailingAnchorPrice'
  | 'trailingLossLimitPercent'
  | 'trailingTakeProfitHighPercent'
  | 'trailingTakeProfitStepPercent'
  | 'lastDcaPrice'
>;

const DEFAULT_REDIS_URL = 'redis://localhost:6379';
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;
const POSITION_STATE_KEY_PREFIX = 'runtime:position-state:';

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const toFinitePositive = (value: unknown): number | null => {
  const parsed = toFiniteNumber(value);
  if (parsed == null || parsed <= 0) return null;
  return parsed;
};

const toFiniteNonNegativeInt = (value: unknown, fallback = 0) => {
  const parsed = toFiniteNumber(value);
  if (parsed == null) return fallback;
  return Math.max(0, Math.floor(parsed));
};

const normalizeState = (value: unknown): PersistedRuntimePositionState | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;

  const quantity = toFinitePositive(raw.quantity);
  const averageEntryPrice = toFinitePositive(raw.averageEntryPrice);
  if (quantity == null || averageEntryPrice == null) return null;

  const trailingAnchorPrice = toFinitePositive(raw.trailingAnchorPrice) ?? averageEntryPrice;
  const trailingLossLimitPercent = toFiniteNumber(raw.trailingLossLimitPercent);
  const trailingTakeProfitHighPercent = toFiniteNumber(raw.trailingTakeProfitHighPercent);
  const trailingTakeProfitStepPercent = toFiniteNumber(raw.trailingTakeProfitStepPercent);
  const lastDcaPrice = toFinitePositive(raw.lastDcaPrice);

  return {
    quantity,
    averageEntryPrice,
    currentAdds: toFiniteNonNegativeInt(raw.currentAdds),
    trailingAnchorPrice,
    trailingLossLimitPercent:
      trailingLossLimitPercent != null ? trailingLossLimitPercent : undefined,
    trailingTakeProfitHighPercent:
      trailingTakeProfitHighPercent != null ? trailingTakeProfitHighPercent : undefined,
    trailingTakeProfitStepPercent:
      trailingTakeProfitStepPercent != null ? trailingTakeProfitStepPercent : undefined,
    lastDcaPrice: lastDcaPrice != null ? lastDcaPrice : undefined,
  };
};

const cloneState = (state: PersistedRuntimePositionState): PersistedRuntimePositionState => ({
  quantity: state.quantity,
  averageEntryPrice: state.averageEntryPrice,
  currentAdds: state.currentAdds,
  trailingAnchorPrice: state.trailingAnchorPrice,
  trailingLossLimitPercent: state.trailingLossLimitPercent,
  trailingTakeProfitHighPercent: state.trailingTakeProfitHighPercent,
  trailingTakeProfitStepPercent: state.trailingTakeProfitStepPercent,
  lastDcaPrice: state.lastDcaPrice,
});

export class RuntimePositionStateStore {
  private readonly memory = new Map<string, { state: PersistedRuntimePositionState; expiresAt: number }>();
  private redisClientPromise: Promise<RedisClient | null> | null = null;

  private async getRedisClient() {
    if (process.env.NODE_ENV === 'test') return null;

    if (!this.redisClientPromise) {
      this.redisClientPromise = (async () => {
        try {
          const client = createClient({
            url: process.env.REDIS_URL || DEFAULT_REDIS_URL,
          });
          client.on('error', () => {
            // Runtime state should gracefully fallback to in-memory if Redis is down.
          });
          await client.connect();
          return client;
        } catch {
          return null;
        }
      })();
    }

    return this.redisClientPromise;
  }

  private getKey(positionId: string) {
    return `${POSITION_STATE_KEY_PREFIX}${positionId}`;
  }

  private getMemory(positionId: string, now = Date.now()) {
    const cached = this.memory.get(positionId);
    if (!cached) return null;
    if (cached.expiresAt <= now) {
      this.memory.delete(positionId);
      return null;
    }
    return cloneState(cached.state);
  }

  private setMemory(positionId: string, state: PersistedRuntimePositionState, now = Date.now()) {
    this.memory.set(positionId, {
      state: cloneState(state),
      expiresAt: now + DEFAULT_TTL_MS,
    });
  }

  async getPositionRuntimeState(positionId: string): Promise<PersistedRuntimePositionState | null> {
    const now = Date.now();
    const fromMemory = this.getMemory(positionId, now);
    if (fromMemory) return fromMemory;

    const redis = await this.getRedisClient();
    if (!redis) return null;

    try {
      const raw = await redis.get(this.getKey(positionId));
      if (!raw) return null;
      const parsed = normalizeState(JSON.parse(raw));
      if (!parsed) return null;
      this.setMemory(positionId, parsed, now);
      return cloneState(parsed);
    } catch {
      return null;
    }
  }

  async getPositionRuntimeStates(positionIds: string[]) {
    const uniqueIds = [...new Set(positionIds.filter((id) => typeof id === 'string' && id.length > 0))];
    const result = new Map<string, PersistedRuntimePositionState>();
    if (uniqueIds.length === 0) return result;

    const now = Date.now();
    const missing: string[] = [];

    for (const positionId of uniqueIds) {
      const cached = this.getMemory(positionId, now);
      if (cached) {
        result.set(positionId, cached);
      } else {
        missing.push(positionId);
      }
    }

    if (missing.length === 0) return result;

    const redis = await this.getRedisClient();
    if (!redis) return result;

    try {
      const payloads = await redis.mGet(missing.map((positionId) => this.getKey(positionId)));
      payloads.forEach((payload, index) => {
        if (!payload) return;
        const positionId = missing[index];
        if (!positionId) return;
        try {
          const parsed = normalizeState(JSON.parse(payload));
          if (!parsed) return;
          this.setMemory(positionId, parsed, now);
          result.set(positionId, cloneState(parsed));
        } catch {
          // Skip malformed payloads.
        }
      });
    } catch {
      return result;
    }

    return result;
  }

  async setPositionRuntimeState(positionId: string, state: PositionManagementState) {
    const normalized = normalizeState(state);
    if (!normalized) return;

    const now = Date.now();
    this.setMemory(positionId, normalized, now);

    const redis = await this.getRedisClient();
    if (!redis) return;

    try {
      await redis.set(this.getKey(positionId), JSON.stringify(normalized), {
        PX: DEFAULT_TTL_MS,
      });
    } catch {
      // Non-blocking: in-memory copy is still available in current process.
    }
  }

  async deletePositionRuntimeState(positionId: string) {
    this.memory.delete(positionId);
    const redis = await this.getRedisClient();
    if (!redis) return;

    try {
      await redis.del(this.getKey(positionId));
    } catch {
      // Best-effort delete.
    }
  }
}

export const runtimePositionStateStore = new RuntimePositionStateStore();
