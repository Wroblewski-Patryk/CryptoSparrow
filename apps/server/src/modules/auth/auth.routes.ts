import { Router } from 'express';
import { register, me, login, logout } from './auth.controller';

const router = Router();

router.post('/register', register);
router.get('/me', me);
router.post('/login', login);
router.post('/logout', logout);
export default router;