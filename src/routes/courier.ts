import { Router } from 'express';
import { 
  getCourierOrders, 
  updateOrderStatusByCourier, 
  assignCourierToOrder, 
  getCouriers, 
  getCourierStats,
  getCourierStatsById
} from '../controllers/courierControllerV2';
import { authenticate, isAdmin, isCourier, isAdminOrCourier } from '../middlewares/auth';
import { idSchema } from '../validators/schemas';

const router = Router();

// Маршруты для курьеров
router.get('/orders', 
  authenticate, 
  isCourier, 
  getCourierOrders
);

router.get('/stats', 
  authenticate, 
  isCourier, 
  getCourierStats
);

router.put('/orders/:id/status', 
  authenticate, 
  isCourier,
  updateOrderStatusByCourier
);

// Маршруты для админов (управление курьерами)
router.get('/list', 
  authenticate, 
  isAdmin, 
  getCouriers
);

router.get('/:id/stats', 
  authenticate, 
  isAdmin,
  getCourierStatsById
);

router.post('/assign', 
  authenticate, 
  isAdmin,
  assignCourierToOrder
);

export default router;
