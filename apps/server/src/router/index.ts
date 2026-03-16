import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import dashboardRoutes from './dashboard.routes';
import adminRoutes from './admin.routes';
import uploadRouter from '../modules/upload/upload.routes';

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

router.use('/upload', uploadRouter);

export default router;
