import { Router } from 'express';
import { login, logout, me, updateProfile, changePassword } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/login', login);

// Protected routes
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);
router.put('/profile', authenticate, updateProfile);
router.post('/change-password', authenticate, changePassword);

export default router;
