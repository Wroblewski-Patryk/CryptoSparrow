import { Router } from 'express';
import { register, me, login, logout } from './auth.controller';
import { createRateLimiter } from '../../middleware/rateLimit';

const router = Router();
const authLimiter = createRateLimiter({ windowMs: 60_000, max: 20, keyScope: 'auth' });
const loginLimiter = createRateLimiter({ windowMs: 60_000, max: 10, keyScope: 'auth' });

router.post('/register', authLimiter, register);
router.get('/me', authLimiter, me);
router.post('/login', loginLimiter, login);
router.post('/logout', authLimiter, logout);
export default router;
