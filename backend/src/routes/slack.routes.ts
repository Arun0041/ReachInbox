import { Router } from 'express';
import { slackConnectStart, slackCallback, slackStatus, disconnectSlackRequest } from '../controllers/slack.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/connect', authenticate, asyncHandler(slackConnectStart));
router.get('/callback', asyncHandler(slackCallback));
router.get('/status', authenticate, asyncHandler(slackStatus));
router.post('/disconnect', authenticate, asyncHandler(disconnectSlackRequest));

export default router;