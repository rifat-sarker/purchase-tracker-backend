import { Router } from 'express';
import requireAuth from '../../middlewares/requireAuth';
import { loginLimiter } from '../../middlewares/rateLimiter';
import validateRequest from '../../middlewares/validateRequest';
import authController from './auth.controller';
import authValidation from './auth.validation';

const router = Router();

router.post('/login', loginLimiter, validateRequest(authValidation.loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', requireAuth, authController.logout);

export default router;
