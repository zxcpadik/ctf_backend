import { Router } from 'express';
import auth_routes        from './auth.routes';
import game_routes        from './game.routes';
import task_group_routes  from './task-group.routes';
import task_routes        from './tasks.routes';
import submission_routes  from './submission.routes';
import team_routes        from './teams.routes';
import config_routes      from './config.routes';
import admin_routes       from './admin.routes';

const router: Router = Router();

router.use('/auth',         auth_routes);
router.use('/game',         game_routes);
router.use('/task-groups',  task_group_routes);
router.use('/tasks',        task_routes);
router.use('/submissions',  submission_routes);
router.use('/teams',        team_routes);
router.use('/configs',      config_routes);
router.use('/admin',        admin_routes);

export { router };
export default router;