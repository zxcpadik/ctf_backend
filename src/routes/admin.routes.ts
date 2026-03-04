import { Router } from 'express';
import AdminController from '../controllers/admin.controller';
import AuthMiddleware from '../middleware/auth.middleware';

const router: Router = Router();

const { authenticate, ensure_admin } = AuthMiddleware;

// Statistics
router.get('/statistics',             authenticate, ensure_admin,   AdminController.get_statistics);

// Team management
router.get('/teams',                  authenticate, ensure_admin,   AdminController.get_all_teams);
router.get('/teams/:team_uuid',       authenticate, ensure_admin,   AdminController.get_team);
router.delete('/teams/:team_uuid',    authenticate, ensure_admin,   AdminController.delete_team);
router.delete('/teams',               authenticate, ensure_admin,   AdminController.delete_all_teams);

// User management
router.get('/users',                  authenticate, ensure_admin,   AdminController.get_all_users);
router.delete('/users/:user_uuid',    authenticate, ensure_admin,   AdminController.delete_user);

// Code generation
router.post('/codes/team-leader',     authenticate, ensure_admin,   AdminController.generate_leader_code);

export default router;