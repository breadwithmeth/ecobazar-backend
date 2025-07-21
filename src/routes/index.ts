import { Router } from 'express';

import authRoutes from './auth';
import storeRoutes from './store';
import productRoutes from './product';
import orderRoutes from './order';
import stockRoutes from './stock';
import categoryRoutes from './category';
import userRoutes from './user';
import userAddressRoutes from './userAddress';

const router = Router();


router.use('/auth', authRoutes);
router.use('/stores', storeRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/stock', stockRoutes);
router.use('/categories', categoryRoutes);
router.use('/user', userRoutes);
router.use('/user', userAddressRoutes);

export default router;
