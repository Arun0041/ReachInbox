import { Router } from 'express';
import { createEmails, listScheduled, listSent, search, cancelEmailRequest } from '../controllers/email.controller';
import { authenticate } from '../middleware/auth';
import { emailRateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticate);
router.post('/', asyncHandler(emailRateLimit), asyncHandler(createEmails));
router.get('/scheduled', asyncHandler(listScheduled));
router.get('/sent', asyncHandler(listSent));
router.get('/search', asyncHandler(search));
router.delete('/:id', asyncHandler(cancelEmailRequest));

export default router;