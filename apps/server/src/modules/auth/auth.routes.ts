import { Router } from 'express';
import { register } from './auth.controller';
// import { login, register } from './auth.controller';

const router = Router();

// router.post('/login', login);
router.post('/register', register);

export default router;