import { Router } from 'express';
import authRoutes from './auth.routes';
import adminRoutes from './admin.routes';
import gameRoutes from './game.routes';
import taskGroupRoutes from './task-group.routes';
import taskRoutes from './tasks.routes';
import submissionRoutes from './submission.routes';
import leaderboardRoutes from './leaderboard.routes';
import teamRoutes from './teams.routes';

const router: Router = Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/game', gameRoutes);
router.use('/task-groups', taskGroupRoutes);
router.use('/tasks', taskRoutes);
router.use('/submissions', submissionRoutes);
router.use('/leaderboard', leaderboardRoutes);
router.use('/teams', teamRoutes);

export { router };
export default router;