import { Router } from 'express';
import { createProduct, getProducts } from '../controllers/productController';
import { updateProductPrice } from '../controllers/productPriceController';
import { authenticate, isAdmin } from '../middlewares/auth';

const router = Router();


router.get('/', getProducts);
router.post('/', authenticate, isAdmin, createProduct);

// PATCH /api/products/:id/price — изменить цену товара (только ADMIN)
router.patch('/:id/price', authenticate, isAdmin, updateProductPrice);

export default router;
