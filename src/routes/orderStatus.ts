import { Router } from 'express';
import { getOrderStatuses, addOrderStatus } from '../controllers/orderStatusController';
import { authenticate, isAdmin } from '../middlewares/auth';

const router = Router();

router.get('/:orderId/statuses', authenticate, getOrderStatuses);
router.post('/:orderId/statuses', authenticate, isAdmin, addOrderStatus);

export default router;
