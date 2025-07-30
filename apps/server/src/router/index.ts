import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import dashboardRoutes from './dashboard.routes';
import adminRoutes from './admin.routes';
import uploadRouter from 'modules/upload/upload.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/admin', adminRoutes);


// Health check route
router.get('/', (_, res) => {
  res.send('🚀 CryptoSparrow API is running');
});
router.use('/upload', uploadRouter);


export default router;
