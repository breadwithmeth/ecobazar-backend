import { Router } from 'express';
import { createStockMovement, getStock, getStockHistory, updateStock } from '../controllers/stockController';
import { authenticate, isAdmin } from '../middlewares/auth';

const router = Router();

router.post('/movements', authenticate, isAdmin, createStockMovement);
router.get('/:productId', authenticate, isAdmin, getStock);
router.get('/history/:productId', authenticate, isAdmin, getStockHistory);
router.put('/:productId', authenticate, isAdmin, updateStock);

export default router;
