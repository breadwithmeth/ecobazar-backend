import { Router } from 'express';
import { addAddress, deleteAddress, getAddresses } from '../controllers/userAddressController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.get('/addresses', authenticate, getAddresses);
router.post('/addresses', authenticate, addAddress);
router.delete('/addresses/:id', authenticate, deleteAddress);

export default router;
