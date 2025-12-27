import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
} from '../controllers/userController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All user management routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
