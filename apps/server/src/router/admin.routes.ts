import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(requireAuth, requireRole('ADMIN'));

router.get('/users', (req, res) => {
  res.json({ message: 'Panel admina, widoczny tylko dla admina!' });
});

export default router;
