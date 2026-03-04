import { Request, Response } from 'express';
import TaskGroupService from '../services/task-group.service';
import logger from '../services/logger.service';
import MyError from '../utils/myerror.util';

class TaskGroupController {
  /**
   * GET /task-groups
   * Admin: all groups with tasks.
   * User:  active groups with active tasks only.
   */
  static async get_all(req: Request, res: Response): Promise<void> {
    try {
      const groups = await TaskGroupService.get_all(['tasks']);

      const data = req.is_admin ? groups : groups
        .filter(g => g.is_active)
        .map(g => ({ ...g, tasks: g.tasks?.filter(t => t.is_active) ?? [] }));

      res.status(200).json({ success: true, data });
    } catch (error: any) {
      logger.error("Get all task groups error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /task-groups/:group_uuid
   * Admin: full group. User: only if group is active; tasks filtered to active.
   */
  static async get(req: Request, res: Response): Promise<void> {
    try {
      const group = await TaskGroupService.get(req.params.group_uuid, ['tasks']);

      if (!group) {
        res.status(404).json({ success: false, message: "Task group not found" });
        return;
      }

      if (!req.is_admin) {
        if (!group.is_active) {
          res.status(404).json({ success: false, message: "Task group not found" });
          return;
        }
        res.status(200).json({
          success: true,
          data: { ...group, tasks: group.tasks?.filter(t => t.is_active) ?? [] },
        });
        return;
      }

      res.status(200).json({ success: true, data: group });
    } catch (error: any) {
      logger.error("Get task group error:", error);
      res.status(error instanceof MyError ? (error.code || 500) : 500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /task-groups
   * Admin only.
   */
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const { name, description } = req.body;
      const group = await TaskGroupService.create(name, description);
      res.status(201).json({ success: true, data: group });
    } catch (error: any) {
      logger.error("Create task group error:", error);
      res.status(error instanceof MyError ? (error.code || 500) : 400).json({ success: false, message: error.message });
    }
  }

  /**
   * PUT /task-groups/:group_uuid
   * Admin only.
   */
  static async update(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, is_active } = req.body;
      const group = await TaskGroupService.update(req.params.group_uuid, { name, description, is_active });
      res.status(200).json({ success: true, data: group });
    } catch (error: any) {
      logger.error("Update task group error:", error);
      res.status(error instanceof MyError ? (error.code || 500) : 400).json({ success: false, message: error.message });
    }
  }

  /**
   * DELETE /task-groups/:group_uuid
   * Admin only.
   */
  static async delete(req: Request, res: Response): Promise<void> {
    try {
      await TaskGroupService.delete(req.params.group_uuid);
      res.status(200).json({ success: true, message: "Task group deleted successfully" });
    } catch (error: any) {
      logger.error("Delete task group error:", error);
      res.status(error instanceof MyError ? (error.code || 500) : 400).json({ success: false, message: error.message });
    }
  }
}

export { TaskGroupController };
export default TaskGroupController;