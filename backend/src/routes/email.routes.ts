import { Router } from 'express';
import { createEmail, listScheduled, listSent, cancelEmailRequest } from '../controllers/email.controller';
import { authenticate } from '../middleware/auth';
import { emailRateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticate);
router.post('/', emailRateLimit, asyncHandler(createEmail));
router.get('/scheduled', asyncHandler(listScheduled));
router.get('/sent', asyncHandler(listSent));
router.delete('/:id', asyncHandler(cancelEmailRequest));

export default router;