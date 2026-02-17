import { Router } from 'express';
import TaskGroupController from '../controllers/task-group.controller'; // Updated import
import AuthMiddleware from '../middleware/auth.middleware';

const router: Router = Router();

// Task Group Management
router.get('/', AuthMiddleware.authenticate, TaskGroupController.get_all_task_groups);
router.post('/', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, TaskGroupController.createTaskGroup);
router.get('/:groupId', AuthMiddleware.authenticate, TaskGroupController.getTaskGroupById);
router.put('/:groupId', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, TaskGroupController.updateTaskGroup);
router.delete('/:groupId', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, TaskGroupController.deleteTaskGroup);

// Batch Operations
router.patch('/batch/status', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, TaskGroupController.batchUpdateTaskGroupStatus);
router.delete('/batch', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, TaskGroupController.batchDeleteTaskGroups);

export default router;