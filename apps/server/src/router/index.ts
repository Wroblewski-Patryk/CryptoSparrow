import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import dashboardRoutes from './dashboard.routes';
import adminRoutes from './admin.routes';
import uploadRouter from '../modules/upload/upload.routes';
import { metricsStore } from '../observability/metrics';

const router = Router();

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/admin', adminRoutes);

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
  const missing = [!process.env.JWT_SECRET && 'JWT_SECRET'].filter(Boolean);
  if (missing.length > 0) {
    return res.status(503).json({
      status: 'not_ready',
      service: 'api',
      missing,
    });
  }

  return res.status(200).json({
    status: 'ready',
    service: 'api',
  });
});

router.get('/metrics', (_req, res) => {
  return res.status(200).json(metricsStore.snapshot());
});

router.get('/workers/health', (_req, res) => {
  const mode = process.env.WORKER_MODE?.trim() || 'inline';
  return res.status(200).json({
    status: 'ok',
    service: 'workers',
    mode,
    timestamp: new Date().toISOString(),
  });
});

router.get('/workers/ready', (_req, res) => {
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

router.use('/upload', uploadRouter);

export default router;
