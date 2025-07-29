import { Router, Request } from 'express';
import { requireAuth } from '../middleware/requireAuth';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

const router = Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  res.json({ message: 'Witaj w dashboardzie', user: req.user });
});


export default router;