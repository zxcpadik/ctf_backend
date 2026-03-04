import { Router } from 'express';
import TaskController from '../controllers/task.controller';
import AuthMiddleware from '../middleware/auth.middleware';
import GameMiddleware from '../middleware/game.middleware';

const router: Router = Router();

const { authenticate, ensure_setup_done, ensure_admin } = AuthMiddleware;
const { ensure_tasks_visible, ensure_game_running }     = GameMiddleware;

// Files — declared before /:task_uuid to avoid param shadowing
router.get('/files/:file_uuid',   authenticate, ensure_setup_done, ensure_tasks_visible,  TaskController.download_file);

// CRUD
router.get('/',                   authenticate, ensure_setup_done, ensure_tasks_visible,  TaskController.get_all);
router.post('/',                  authenticate, ensure_admin,                             TaskController.create);
router.get('/:task_uuid',         authenticate, ensure_setup_done, ensure_tasks_visible,  TaskController.get);
router.put('/:task_uuid',         authenticate, ensure_admin,                             TaskController.update);
router.delete('/:task_uuid',      authenticate, ensure_admin,                             TaskController.delete);

export default router;