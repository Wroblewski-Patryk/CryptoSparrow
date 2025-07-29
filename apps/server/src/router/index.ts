import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import dashboardRoutes from './dashboard.routes';
import adminRoutes from './admin.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/admin', adminRoutes);


// Health check route
router.get('/', (_, res) => {
  res.send('🚀 CryptoSparrow API is running');
});

export default router;
