import { Router } from 'express';
import { getSenders, createSenderRequest } from '../controllers/sender.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticate);
router.get('/', asyncHandler(getSenders));
router.post('/', asyncHandler(createSenderRequest));

export default router;