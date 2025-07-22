import { Router } from 'express';
import { changeUserRole } from '../controllers/userController';
import { authenticate, isAdmin } from '../middlewares/auth';
import { adminRateLimit } from '../middlewares/security';
import { validateBody, validateParams, schemas } from '../middlewares/validation';

const router = Router();

// Изменить роль пользователя
router.post('/users/:id/role', 
  adminRateLimit,
  authenticate, 
  isAdmin,
  validateParams(schemas.id),
  validateBody({
    role: { 
      required: true, 
      type: 'string' as const,
      custom: (value: string) => {
        const allowedRoles = ['CUSTOMER', 'COURIER', 'ADMIN'];
        return allowedRoles.includes(value) || `Роль должна быть одной из: ${allowedRoles.join(', ')}`;
      }
    }
  }),
  changeUserRole
);

export default router;
