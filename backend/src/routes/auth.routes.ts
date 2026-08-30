import { Router } from 'express';
import { register, login, me } from '../controllers/auth.controller';
import { googleAuthStart, googleAuthCallback } from '../controllers/google.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.get('/me', authenticate, asyncHandler(me));
router.get('/google', asyncHandler(googleAuthStart));
router.get('/google/callback', asyncHandler(googleAuthCallback));

export default router;