import { Router } from 'express';
import AuthController from '../controllers/auth.controller';
import AuthMiddleware from '../middleware/auth.middleware';

const router: Router = Router();

// Authentication
router.post('/login/admin', AuthController.adminLogin);
router.post('/login/user', AuthController.userLogin);
router.post('/logout', AuthMiddleware.authenticate, AuthController.logout);

// Current User
router.get('/me', AuthMiddleware.authenticate, AuthController.getCurrentUser);

// Profile Setup
router.patch('/profile/username', AuthMiddleware.authenticate, AuthController.setUsername);
router.patch('/profile/team-name', AuthMiddleware.authenticate, AuthMiddleware.ensureLeader, AuthController.setTeamName);

export default router;