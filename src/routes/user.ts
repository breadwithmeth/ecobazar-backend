import { Router } from 'express';
import { getMe, updateMe, getAllUsers } from '../controllers/userController';
import { authenticate, isAdmin } from '../middlewares/auth';
import { adminRateLimit } from '../middlewares/security';

const router = Router();

// Получить свой профиль
router.get('/me', authenticate, getMe);

// Обновить свой профиль
router.patch('/me', authenticate, updateMe);

// Получить всех пользователей (только для администраторов)
router.get('/admin/all', 
  adminRateLimit,
  authenticate, 
  isAdmin, 
  getAllUsers
);

export default router;
