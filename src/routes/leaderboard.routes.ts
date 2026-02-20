import { Router } from 'express';
import LeaderboardController from '../controllers/leaderboard.controller';
import AuthMiddleware from '../middleware/auth.middleware';

const router: Router = Router();

// Leaderboard
router.get('/', AuthMiddleware.authenticate, AuthMiddleware.ensureAccountFinalized, LeaderboardController.getLeaderboard);

export default router;