import { Router } from 'express';
import TaskGroupController from '../controllers/task-group.controller';
import AuthMiddleware from '../middleware/auth.middleware';
import GameMiddleware from '../middleware/game.middleware';

const router: Router = Router();

const { authenticate, ensure_setup_done, ensure_admin } = AuthMiddleware;
const { ensure_tasks_visible }                          = GameMiddleware;

router.get('/',                   authenticate, ensure_setup_done, ensure_tasks_visible,  TaskGroupController.get_all);
router.post('/',                  authenticate, ensure_admin,                             TaskGroupController.create);
router.get('/:group_uuid',        authenticate, ensure_setup_done, ensure_tasks_visible,  TaskGroupController.get);
router.put('/:group_uuid',        authenticate, ensure_admin,                             TaskGroupController.update);
router.delete('/:group_uuid',     authenticate, ensure_admin,                             TaskGroupController.delete);

export default router;