import { Router } from 'express';
import AuthController from '../controllers/auth.controller';
import AuthMiddleware from '../middleware/auth.middleware';

const router: Router = Router();

// Authentication
router.post('/admin', AuthController.admin_auth);
router.post('/user', AuthController.user_auth);
router.post('/logout', AuthMiddleware.authenticate, AuthController.logout);

// Current User
router.get('/me', AuthMiddleware.authenticate, AuthController.get_current_user);

// Profile Setup
router.patch('/username', AuthMiddleware.authenticate, AuthController.set_username);
router.patch('/team_name', AuthMiddleware.authenticate, AuthMiddleware.ensureLeader, AuthController.set_team_name);

export default router;