import { Router } from 'express';
import { 
  createProduct, 
  getProducts, 
  getAllProducts,
  getProduct, 
  updateProduct, 
  deleteProduct 
} from '../controllers/productController';
import { updateProductPrice } from '../controllers/productPriceController';
import { authenticate, isAdmin } from '../middlewares/auth';
import { validateBody, validateParams, schemas } from '../middlewares/validation';

const router = Router();

// Получить все товары с пагинацией (публичный доступ)
router.get('/', getProducts);

// Получить ВСЕ товары сразу без пагинации (публичный доступ)
router.get('/all', getAllProducts);

// Получить товар по ID (публичный доступ)
router.get('/:id', validateParams(schemas.id), getProduct);

// Создать товар (только для администраторов)
router.post('/', 
  authenticate, 
  isAdmin, 
  validateBody(schemas.createProduct), 
  createProduct
);

// Обновить товар (только для администраторов)
router.put('/:id', 
  authenticate, 
  isAdmin, 
  validateParams(schemas.id),
  validateBody({
    name: { type: 'string' as const, minLength: 1, maxLength: 200 },
    price: { type: 'number' as const, min: 0 },
    storeId: { type: 'number' as const, min: 1 },
    image: { type: 'string' as const, maxLength: 500 },
    categoryId: { type: 'number' as const, min: 1 },
    unit: { type: 'string' as const, minLength: 1, maxLength: 20 } // добавлено
  }),
  updateProduct
);

// Удалить товар (только для администраторов)
router.delete('/:id', 
  authenticate, 
  isAdmin, 
  validateParams(schemas.id),
  deleteProduct
);

// Изменить цену товара (только для администраторов)
router.patch('/:id/price', 
  authenticate, 
  isAdmin, 
  validateParams(schemas.id),
  validateBody({
    price: { required: true, type: 'number' as const, min: 0 }
  }),
  updateProductPrice
);

export default router;
