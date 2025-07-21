import { Router } from 'express';
import { createOrder, getOrders, getAllOrders } from '../controllers/orderController';
import { updateOrderStatus } from '../controllers/orderStatusController';
import { authenticate, isAdmin } from '../middlewares/auth';

const router = Router();




router.post('/', authenticate, createOrder);
router.get('/', authenticate, getOrders);
router.get('/all', authenticate, isAdmin, getAllOrders); // только для ADMIN

// PUT /api/orders/:id/status — сменить статус заказа (только ADMIN)
router.put('/:id/status', authenticate, isAdmin, updateOrderStatus);

export default router;
