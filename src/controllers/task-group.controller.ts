import { Request, Response } from 'express';
import TaskGroupService from '../services/task-group.service';
import logger from '../services/logger.service';
import { ResponseInterface } from '../interfaces/response.interface';
import GameService from '../services/game.service';

class TaskGroupController {
  /**
   * Create a new task group (Admin only)
   */
  static async createTaskGroup(req: Request, res: Response): Promise<void> {
    try {
      const { name, description } = req.body;

      if (!name) {
        const response: ResponseInterface = {
          success: false,
          message: "Group name is required"
        };
        res.status(400).json(response);
        return;
      }

      const group = await TaskGroupService.createTaskGroup(name, description);

      const response: ResponseInterface = {
        success: true,
        message: "Task group created successfully",
        data: group
      };

      res.status(201).json(response);
    } catch (error: any) {
      logger.error("Create task group error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to create task group"
      };

      res.status(400).json(response);
    }
  }

  /**
   * Get all task groups
   */
  static async getAllTaskGroups(req: Request, res: Response): Promise<void> {
    try {
      const includeTasks = req.query.includeTasks !== 'false'; // Default to true
      const isGameActive = await GameService.isGameActive();
      const isAdmin = req.isAdmin || false;

      const groups = await TaskGroupService.getAllTaskGroups(includeTasks, isGameActive, isAdmin);

      const response: ResponseInterface = {
        success: true,
        message: "Task groups retrieved successfully",
        data: groups
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Get all task groups error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to retrieve task groups"
      };

      res.status(500).json(response);
    }
  }

  /**
   * Get a specific task group by ID
   */
  static async getTaskGroupById(req: Request, res: Response): Promise<void> {
    try {
      const { groupId } = req.params;
      const includeTasks = req.query.includeTasks !== 'false';

      const group = await TaskGroupService.getTaskGroupById(groupId, includeTasks);

      if (!group) {
        const response: ResponseInterface = {
          success: false,
          message: "Task group not found"
        };
        res.status(404).json(response);
        return;
      }

      const response: ResponseInterface = {
        success: true,
        message: "Task group retrieved successfully",
        data: group
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Get task group error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to retrieve task group"
      };

      res.status(500).json(response);
    }
  }

  /**
   * Update a task group (Admin only)
   */
  static async updateTaskGroup(req: Request, res: Response): Promise<void> {
    try {
      const { groupId } = req.params;
      const { name, description, isActive } = req.body;

      const group = await TaskGroupService.updateTaskGroup(groupId, { name, description, isActive });

      const response: ResponseInterface = {
        success: true,
        message: "Task group updated successfully",
        data: group
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Update task group error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to update task group"
      };

      res.status(400).json(response);
    }
  }

  /**
   * Delete a task group (Admin only)
   */
  static async deleteTaskGroup(req: Request, res: Response): Promise<void> {
    try {
      const { groupId } = req.params;

      await TaskGroupService.deleteTaskGroup(groupId);

      const response: ResponseInterface = {
        success: true,
        message: "Task group deleted successfully"
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Delete task group error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to delete task group"
      };

      res.status(400).json(response);
    }
  }

  /**
   * Batch update task groups status (Admin only)
   */
  static async batchUpdateTaskGroupStatus(req: Request, res: Response): Promise<void> {
    try {
      const { groupIds, isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        const response: ResponseInterface = {
          success: false,
          message: "isActive must be a boolean"
        };
        res.status(400).json(response);
        return;
      }

      await TaskGroupService.batchUpdateTaskGroups(groupIds || [], isActive);

      const response: ResponseInterface = {
        success: true,
        message: "Task groups updated successfully"
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Batch update task groups error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to update task groups"
      };

      res.status(400).json(response);
    }
  }

  /**
   * Batch delete task groups (Admin only)
   */
  static async batchDeleteTaskGroups(req: Request, res: Response): Promise<void> {
    try {
      const { groupIds } = req.body;

      if (!Array.isArray(groupIds) || groupIds.length === 0) {
        const response: ResponseInterface = {
          success: false,
          message: "groupIds must be a non-empty array"
        };
        res.status(400).json(response);
        return;
      }

      await TaskGroupService.batchDeleteTaskGroups(groupIds);

      const response: ResponseInterface = {
        success: true,
        message: "Task groups deleted successfully"
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Batch delete task groups error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to delete task groups"
      };

      res.status(400).json(response);
    }
  }
}

export default TaskGroupController;