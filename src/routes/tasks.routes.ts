import { Router } from 'express';
import TaskController from '../controllers/task.controller';
import AuthMiddleware from '../middleware/auth.middleware';

const router: Router = Router();

// Task Management
router.get('/', AuthMiddleware.authenticate, AuthMiddleware.ensureAccountFinalized, TaskController.getAllTasks);
router.post('/', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, TaskController.createTask);
router.get('/:taskId', AuthMiddleware.authenticate, AuthMiddleware.ensureAccountFinalized, TaskController.getTaskById);
router.put('/:taskId', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, TaskController.updateTask);
router.delete('/:taskId', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, TaskController.deleteTask);

// Task Files
router.get('/:taskId/files/:fileId', AuthMiddleware.authenticate, AuthMiddleware.ensureAccountFinalized, TaskController.downloadTaskFile);

// Batch Operations
router.patch('/batch/status', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, TaskController.batchUpdateTaskStatus);
router.delete('/batch', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, TaskController.batchDeleteTasks);

// Solved Tasks
router.get('/solved/me', AuthMiddleware.authenticate, AuthMiddleware.ensureAccountFinalized, TaskController.getMySolvedTasks);
router.get('/solved/team/:teamId', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, TaskController.getSolvedTasksByTeam);

export default router;