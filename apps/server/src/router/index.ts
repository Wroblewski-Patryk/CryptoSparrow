import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
// import botRoutes from '../modules/bot/bot.routes'; ← przyszłość

const router = Router();

router.use('/auth', authRoutes);
// router.use('/bots', botRoutes);


// Health check route
router.get('/', (_, res) => {
  res.send('🚀 CryptoSparrow API is running');
});

export default router;
