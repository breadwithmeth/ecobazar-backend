import { Router } from 'express';
import { getMe, updateMe } from '../controllers/userController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.get('/me', authenticate, getMe);
router.patch('/me', authenticate, updateMe);

export default router;
