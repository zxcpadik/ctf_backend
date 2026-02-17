import { Router } from 'express';
import auth_routes from './auth.routes';
import admin_routes from './admin.routes';
import gameRoutes from './game.routes';
import task_group_routes from './task-group.routes';
import taskRoutes from './tasks.routes';
import submissionRoutes from './submission.routes';
import leaderboardRoutes from './leaderboard.routes';
import teamRoutes from './teams.routes';

const router: Router = Router();

router.use('/auth', auth_routes);
router.use('/admin', admin_routes);
router.use('/game', gameRoutes);
router.use('/task-groups', task_group_routes);
router.use('/tasks', taskRoutes);
router.use('/submissions', submissionRoutes);
router.use('/leaderboard', leaderboardRoutes);
router.use('/teams', teamRoutes);

export { router };
export default router;