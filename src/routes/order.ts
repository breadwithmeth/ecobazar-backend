import { Router } from 'express';
import { createOrder, getOrders, getAllOrders, getOrder } from '../controllers/orderController';
import { updateOrderStatus } from '../controllers/orderStatusController';
import { authenticate, isAdmin } from '../middlewares/auth';
import { validateBody, validateParams, schemas } from '../middlewares/validation';
import { adminRateLimit } from '../middlewares/security';

const router = Router();

// Создать заказ (для авторизованных пользователей)
router.post('/', 
  authenticate, 
  validateBody(schemas.createOrder), 
  createOrder
);

// Получить свои заказы (для авторизованных пользователей)
router.get('/', authenticate, getOrders);

// Получить конкретный заказ (для авторизованных пользователей)
router.get('/:id', 
  authenticate, 
  validateParams(schemas.id), 
  getOrder
);

// Получить все заказы (только для администраторов)
router.get('/admin/all', 
  adminRateLimit,
  authenticate, 
  isAdmin, 
  getAllOrders
);

// Изменить статус заказа (только для администраторов)
router.put('/:id/status', 
  adminRateLimit,
  authenticate, 
  isAdmin, 
  validateParams(schemas.id),
  validateBody({
    status: { 
      required: true, 
      type: 'string' as const,
      custom: (value: string) => {
        const allowedStatuses = ['NEW', 'WAITING_PAYMENT', 'ASSEMBLY', 'SHIPPING', 'DELIVERED'];
        return allowedStatuses.includes(value) || `Статус должен быть одним из: ${allowedStatuses.join(', ')}`;
      }
    }
  }),
  updateOrderStatus
);

export default router;
