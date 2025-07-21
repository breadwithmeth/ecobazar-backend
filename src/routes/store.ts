import { Router } from 'express';
import { createStore, getStores } from '../controllers/storeController';
import { authenticate, isAdmin } from '../middlewares/auth';

const router = Router();

router.get('/', getStores);
router.post('/', authenticate, isAdmin, createStore);

export default router;
