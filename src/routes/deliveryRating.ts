import { Router } from 'express';
import { 
  createDeliveryRating, 
  getDeliveryRating, 
  getCourierRatingStats,
  getAllRatings
} from '../controllers/deliveryRatingController';
import { authenticate, isAdmin } from '../middlewares/auth';
import { validateBody, validateParams, validateQuery } from '../middlewares/zodValidation';
import { 
  createDeliveryRatingSchema, 
  idSchema,
  getRatingsQuerySchema
} from '../validators/schemas';

const router = Router();

// Создать оценку доставки (для клиентов)
router.post('/', 
  authenticate, 
  validateBody(createDeliveryRatingSchema),
  createDeliveryRating
);

// Получить оценку доставки по заказу (для клиентов и админов)
router.get('/order/:id', 
  authenticate, 
  validateParams(idSchema),
  getDeliveryRating
);

// Получить статистику оценок курьера (для админов)
router.get('/courier/:id/stats', 
  authenticate, 
  isAdmin,
  validateParams(idSchema),
  getCourierRatingStats
);

// Получить все оценки с фильтрацией (для админов)
router.get('/admin/all', 
  authenticate, 
  isAdmin,
  validateQuery(getRatingsQuerySchema),
  getAllRatings
);

export default router;
