import { Router } from 'express';
import { register, login, forgotPassword, resetPassword, logout } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

const asyncHandler = (fn: any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.post('/forgot-password', asyncHandler(forgotPassword));
router.post('/reset-password', asyncHandler(resetPassword));
router.post('/logout', authenticate, asyncHandler(logout));

export default router; 