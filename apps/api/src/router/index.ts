import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import dashboardRoutes from './dashboard.routes';
import adminRoutes from './admin.routes';
import uploadRouter from '../modules/upload/upload.routes';
import { metricsStore } from '../observability/metrics';
import { evaluateRuntimeAlerts } from '../observability/alerts';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { requireOpsNetwork } from '../middleware/requireOpsNetwork';
import { applyNoStoreHeaders } from '../middleware/noStoreHeaders';
import { evaluateCriticalSecretsReadiness } from '../config/criticalSecretsReadiness';
import { buildRuntimeFreshnessSnapshot } from '../observability/runtimeFreshness';

const router = Router();

router.use('/auth', applyNoStoreHeaders, authRoutes);
router.use('/dashboard', applyNoStoreHeaders, dashboardRoutes);
router.use('/admin', applyNoStoreHeaders, adminRoutes);

router.get('/', (_req, res) => {
  res.send('CryptoSparrow API is running');
});

router.get('/health', (_req, res) => {
  return res.status(200).json({
    status: 'ok',
    service: 'api',
    timestamp: new Date().toISOString(),
  });
});

router.get('/ready', (_req, res) => {
  const readiness = evaluateCriticalSecretsReadiness();
  if (!readiness.ready) {
    return res.status(503).json({
      status: 'not_ready',
      service: 'api',
    });
  }

  return res.status(200).json({
    status: 'ready',
    service: 'api',
  });
});

const requireOpsAccess = [requireAuth, requireRole('ADMIN'), requireOpsNetwork] as const;

router.get('/ready/details', ...requireOpsAccess, (_req, res) => {
  const readiness = evaluateCriticalSecretsReadiness();
  if (!readiness.ready) {
    return res.status(503).json({
      status: 'not_ready',
      service: 'api',
      missing: readiness.missing,
      issues: readiness.issues,
    });
  }

  return res.status(200).json({
    status: 'ready',
    service: 'api',
    missing: [],
    issues: [],
  });
});

router.get('/metrics', ...requireOpsAccess, (_req, res) => {
  return res.status(200).json(metricsStore.snapshot());
});

router.get('/alerts', ...requireOpsAccess, (_req, res) => {
  const nowMs = Date.now();
  const marketDataLastAtRaw = process.env.WORKER_LAST_MARKET_DATA_AT ?? '';
  const workerHeartbeatLastAtRaw = process.env.WORKER_LAST_HEARTBEAT_AT ?? '';
  const marketDataLastAtMs = Number.isNaN(Date.parse(marketDataLastAtRaw))
    ? null
    : Date.parse(marketDataLastAtRaw);
  const workerHeartbeatLastAtMs = Number.isNaN(Date.parse(workerHeartbeatLastAtRaw))
    ? null
    : Date.parse(workerHeartbeatLastAtRaw);

  const alerts = evaluateRuntimeAlerts({
    nowMs,
    marketDataLastAtMs,
    workerHeartbeatLastAtMs,
  });

  return res.status(200).json({ alerts });
});

router.get('/workers/health', ...requireOpsAccess, (_req, res) => {
  const mode = process.env.WORKER_MODE?.trim() || 'inline';
  return res.status(200).json({
    status: 'ok',
    service: 'workers',
    mode,
    timestamp: new Date().toISOString(),
  });
});

router.get('/workers/ready', ...requireOpsAccess, (_req, res) => {
  const mode = process.env.WORKER_MODE?.trim() || 'inline';
  const marketDataLag = Number.parseInt(process.env.WORKER_MARKET_DATA_QUEUE_LAG ?? '0', 10);
  const backtestLag = Number.parseInt(process.env.WORKER_BACKTEST_QUEUE_LAG ?? '0', 10);
  const executionLag = Number.parseInt(process.env.WORKER_EXECUTION_QUEUE_LAG ?? '0', 10);
  metricsStore.setWorkerQueueLag('marketData', Number.isNaN(marketDataLag) ? 0 : marketDataLag);
  metricsStore.setWorkerQueueLag('backtest', Number.isNaN(backtestLag) ? 0 : backtestLag);
  metricsStore.setWorkerQueueLag('execution', Number.isNaN(executionLag) ? 0 : executionLag);

  if (mode !== 'split') {
    return res.status(200).json({
      status: 'ready',
      service: 'workers',
      mode,
      details: 'Dedicated workers not required in current mode',
    });
  }

  const missing = [
    !process.env.WORKER_MARKET_DATA_QUEUE && 'WORKER_MARKET_DATA_QUEUE',
    !process.env.WORKER_BACKTEST_QUEUE && 'WORKER_BACKTEST_QUEUE',
    !process.env.WORKER_EXECUTION_QUEUE && 'WORKER_EXECUTION_QUEUE',
  ].filter(Boolean);

  if (missing.length > 0) {
    return res.status(503).json({
      status: 'not_ready',
      service: 'workers',
      mode,
      missing,
    });
  }

  return res.status(200).json({
    status: 'ready',
    service: 'workers',
    mode,
  });
});

router.get('/workers/runtime-freshness', ...requireOpsAccess, async (_req, res) => {
  const snapshot = await buildRuntimeFreshnessSnapshot();
  return res.status(snapshot.status === 'PASS' ? 200 : 503).json(snapshot);
});

router.use('/upload', uploadRouter);

export default router;
