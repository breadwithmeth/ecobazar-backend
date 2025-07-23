import { Router } from 'express';
import { createStore, getStores } from '../controllers/storeController';
import { 
  getStores as getStoresV2,
  getStore,
  getMyStore,
  createStore as createStoreV2,
  updateStore,
  assignStoreOwner,
  deleteStore,
  getStoreOrders,
  getStoreOrderItems,
  confirmOrderItem,
  getStoreStats
} from '../controllers/storeControllerV2';
import { authenticate, isAdmin, isSeller } from '../middlewares/auth';

const router = Router();

// Публичные роуты
router.get('/', getStoresV2);
router.get('/:id', getStore);

// Роуты для SELLER
router.get('/my/store', authenticate, isSeller, getMyStore);
router.get('/my/orders', authenticate, isSeller, getStoreOrders);
router.get('/my/order-items', authenticate, isSeller, getStoreOrderItems);
router.put('/my/order-items/:orderItemId/confirm', authenticate, isSeller, confirmOrderItem);
router.get('/my/stats', authenticate, isSeller, getStoreStats);

// Роуты для ADMIN
router.post('/', authenticate, isAdmin, createStoreV2);
router.put('/:id', authenticate, updateStore);
router.post('/:id/assign-owner', authenticate, isAdmin, assignStoreOwner);
router.delete('/:id', authenticate, isAdmin, deleteStore);

export default router;
