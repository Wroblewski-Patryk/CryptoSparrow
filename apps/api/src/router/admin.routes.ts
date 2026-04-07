import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import subscriptionPlansRouter from '../modules/admin/subscriptionPlans/subscriptionPlans.routes';
import usersRouter from '../modules/admin/users/users.routes';

const router = Router();

router.use(requireAuth, requireRole('ADMIN'));
router.use('/subscriptions/plans', subscriptionPlansRouter);
router.use('/users', usersRouter);

router.get('/', (req, res) => {
  res.json({ message: 'Panel admina, widoczny tylko dla admina!' });
});

export default router;
