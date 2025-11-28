import { Router } from 'express';
import AdminController from '../controllers/admin.controller';
import AuthMiddleware from '../middleware/auth.middleware';

const router: Router = Router();

// Statistics
router.get('/statistics', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, AdminController.getAdminStats);

// Team Management
router.get('/teams', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, AdminController.getAllTeams);
router.get('/teams/:teamId', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, AdminController.getTeamById);
router.get('/teams/:teamId/statistics', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, AdminController.getTeamStatistics);
router.delete('/teams', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, AdminController.deleteAllTeams);

// User Management
router.get('/users', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, AdminController.getAllUsers);
router.get('/users/statistics', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, AdminController.getUserStatistics);
router.delete('/users/:userId', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, AdminController.deleteUser);

// Code Generation
router.post('/codes/team-leader', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, AdminController.generateTeamLeaderCode);

export default router;