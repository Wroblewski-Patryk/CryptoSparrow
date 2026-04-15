import { metricsStore } from '../../observability/metrics';
import { ActiveBot, listActiveRuntimeBots } from './runtimeSignalLoopDefaults';
import { readRuntimeTopologyVersionRaw } from './runtimeSignalLoop.repository';

const runtimeTopologyCacheEnabled = process.env.RUNTIME_TOPOLOGY_CACHE_ENABLED !== 'false';
const runtimeTopologyCacheTtlMs = Math.max(
  1_000,
  Number.parseInt(process.env.RUNTIME_TOPOLOGY_CACHE_TTL_MS ?? '15000', 10)
);

type RuntimeTopologyCacheDeps = {
  fetchActiveBots: () => Promise<ActiveBot[]>;
  readTopologyVersion: () => Promise<string>;
  nowMs: () => number;
  enabled: boolean;
  ttlMs: number;
};

type RuntimeTopologyCacheState = {
  activeBots: ActiveBot[];
  topologyVersion: string;
  expiresAtMs: number;
};

const defaultDeps: RuntimeTopologyCacheDeps = {
  fetchActiveBots: () => listActiveRuntimeBots(),
  readTopologyVersion: () => readRuntimeTopologyVersionRaw(),
  nowMs: () => Date.now(),
  enabled: runtimeTopologyCacheEnabled,
  ttlMs: runtimeTopologyCacheTtlMs,
};

export class RuntimeTopologyCacheService {
  private state: RuntimeTopologyCacheState | null = null;

  constructor(private readonly deps: RuntimeTopologyCacheDeps = defaultDeps) {}

  async getActiveBots() {
    if (!this.deps.enabled) {
      return this.deps.fetchActiveBots();
    }

    const now = this.deps.nowMs();
    if (this.state && now < this.state.expiresAtMs) {
      return this.state.activeBots;
    }

    let runtimeTopologyVersion: string | null = null;
    try {
      runtimeTopologyVersion = await this.deps.readTopologyVersion();
    } catch (error) {
      console.error('RuntimeTopologyCacheService topology-version read failed:', error);
      metricsStore.recordRuntimeExecutionError('runtime_topology_cache_version_read_failure');
      return this.refreshCache(now, null);
    }

    if (this.state && this.state.topologyVersion === runtimeTopologyVersion) {
      this.state.expiresAtMs = now + this.deps.ttlMs;
      return this.state.activeBots;
    }

    return this.refreshCache(now, runtimeTopologyVersion);
  }

  invalidate() {
    this.state = null;
  }

  private async refreshCache(now: number, runtimeTopologyVersion: string | null) {
    const activeBots = await this.deps.fetchActiveBots();
    const topologyVersion =
      runtimeTopologyVersion ?? `fallback:${now}:${Math.max(0, activeBots.length)}`;

    this.state = {
      activeBots,
      topologyVersion,
      expiresAtMs: now + this.deps.ttlMs,
    };

    return activeBots;
  }
}

export const runtimeTopologyCacheService = new RuntimeTopologyCacheService();
