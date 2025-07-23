import { Router } from 'express';

import authRoutes from './auth';
import storeRoutes from './store';
import productRoutes from './product';
import orderRoutes from './order';
import stockRoutes from './stock';
import categoryRoutes from './category';
import userRoutes from './user';
import userAddressRoutes from './userAddress';
import courierRoutes from './courier';
import adminRoutes from './admin';
import deliveryRatingRoutes from './deliveryRating';

const router = Router();

router.use('/auth', authRoutes);
router.use('/stores', storeRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/stock', stockRoutes);
router.use('/categories', categoryRoutes);
router.use('/user', userRoutes);
router.use('/user', userAddressRoutes);
router.use('/courier', courierRoutes);
router.use('/admin', adminRoutes);
router.use('/delivery-ratings', deliveryRatingRoutes);

export default router;
