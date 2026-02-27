import { Request, Response } from 'express';
import TaskService from '../services/task.service';
import GameService from '../services/game.service';
import logger from '../services/logger.service';
import { ResponseInterface } from '../interfaces/response.interface';
import multer from 'multer';
import path from 'path';
import ValidationUtil from '../utils/validation.util';
import s from "http-status";

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage, limits: { files: 100 } });

class TaskController {
  static async getAllTasks(req: Request, res: Response): Promise<void> {
    try {
      const isAdmin = req.isAdmin || false;
      const isGameActive = await GameService.isGameActive();
      const include_group = req.query.include_group === 'true';

      const tasks = await TaskService.getAllTasks(isAdmin, isGameActive, include_group);

      const response: ResponseInterface = {
        success: true,
        message: "Tasks retrieved successfully",
        data: tasks
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Get all tasks error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to retrieve tasks"
      };

      res.status(500).json(response);
    }
  }

  static async getTaskById(req: Request, res: Response): Promise<void> {
    try {
      const { taskId } = req.params;
      const isAdmin = req.isAdmin || false;
      const isGameActive = await GameService.isGameActive();

      if (typeof taskId != 'string') {
        const response: ResponseInterface = {
          success: false,
          message: "Bad request"
        };
        res.status(400).json(response);
        return;
      }

      const task = await TaskService.getTask(taskId, isAdmin, isGameActive);

      if (!task) {
        const response: ResponseInterface = {
          success: false,
          message: "Task not found or inaccessible"
        };
        res.status(404).json(response);
        return;
      }

      const response: ResponseInterface = {
        success: true,
        message: "Task retrieved successfully",
        data: task
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Get task error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to retrieve task"
      };

      res.status(500).json(response);
    }
  }

  static async createTask(req: Request, res: Response): Promise<void> {
    try {
      upload.array('files', 10)(req, res, async (err) => {
        if (err) {
          const response: ResponseInterface = {
            success: false,
            message: "File upload failed"
          };
          res.status(400).json(response);
          return;
        }

        try {
          const { shortName, description, score, flag, groupId } = req.body;
          const files = req.files as Express.Multer.File[];

          const task = await TaskService.createTask(
            shortName,
            description,
            parseInt(score),
            flag,
            groupId,
            files
          );

          const response: ResponseInterface = {
            success: true,
            message: "Task created successfully",
            data: { taskId: task.uuid }
          };

          res.status(201).json(response);
        } catch (error: any) {
          logger.error("Create task error:", error);

          const response: ResponseInterface = {
            success: false,
            message: error.message || "Failed to create task"
          };

          res.status(400).json(response);
        }
      });
    } catch (error: any) {
      logger.error("Create task error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to create task"
      };

      res.status(500).json(response);
    }
  }

  static async updateTask(req: Request, res: Response): Promise<void> {
    try {
      upload.array('newFiles', 10)(req, res, async (err) => {
        if (err) {
          const response: ResponseInterface = {
            success: false,
            message: "File upload failed"
          };
          res.status(400).json(response);
          return;
        }

        try {
          const { taskId } = req.params;
          const { shortName, description, score, flag, groupId, isActive, filesToDelete } = req.body;
          const newFiles = req.files as Express.Multer.File[];
          const filesToDeleteArray = filesToDelete ? JSON.parse(filesToDelete) : [];

          if (typeof taskId != 'string') {
            const response: ResponseInterface = {
              success: false,
              message: "Bad request"
            };
            res.status(400).json(response);
            return;
          }

          const task = await TaskService.updateTask(
            taskId,
            {
              shortName,
              description,
              score: score ? parseInt(score) : undefined,
              flag,
              groupId,
              isActive: isActive ? isActive === 'true' : undefined
            },
            newFiles,
            filesToDeleteArray
          );

          const response: ResponseInterface = {
            success: true,
            message: "Task updated successfully",
            data: task
          };

          res.status(200).json(response);
        } catch (error: any) {
          logger.error("Update task error:", error);

          const response: ResponseInterface = {
            success: false,
            message: error.message || "Failed to update task"
          };

          res.status(400).json(response);
        }
      });
    } catch (error: any) {
      logger.error("Update task error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to update task"
      };

      res.status(500).json(response);
    }
  }

  static async deleteTask(req: Request, res: Response): Promise<void> {
    try {
      const { taskId } = req.params;

      if (typeof taskId != 'string') {
        const response: ResponseInterface = {
          success: false,
          message: "Bad request"
        };
        res.status(400).json(response);
        return;
      }

      await TaskService.deleteTask(taskId);

      const response: ResponseInterface = {
        success: true,
        message: "Task deleted successfully"
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Delete task error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to delete task"
      };

      res.status(400).json(response);
    }
  }

  static async downloadTaskFile(req: Request, res: Response): Promise<void> {
    try {
      const { fileId } = req.params;
      const isAdmin = req.isAdmin || false;
      const isGameActive = await GameService.isGameActive();

      if (typeof fileId != 'string') {
        const response: ResponseInterface = {
          success: false,
          message: "Bad request"
        };
        res.status(400).json(response);
        return;
      }

      const fileInfo = await TaskService.getTaskFile(fileId, isAdmin, isGameActive);

      if (!fileInfo) {
        const response: ResponseInterface = {
          success: false,
          message: "File not found or inaccessible"
        };
        res.status(404).json(response);
        return;
      }

      res.download(fileInfo.file_path, fileInfo.original_name, (err) => {
        if (err) {
          logger.error("File download error:", err);
          if (!res.headersSent) {
            const response: ResponseInterface = {
              success: false,
              message: "Failed to download file"
            };
            res.status(500).json(response);
          }
        }
      });
    } catch (error: any) {
      logger.error("Download task file error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to download file"
      };

      res.status(500).json(response);
    }
  }

  static async batchUpdateTaskStatus(req: Request, res: Response): Promise<void> {
    try {
      const { taskUuids, isActive } = req.body;

      await TaskService.batchUpdateTaskActiveStatus(taskUuids || [], isActive);

      const response: ResponseInterface = {
        success: true,
        message: "Tasks updated successfully"
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Batch update task status error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to update tasks"
      };

      res.status(400).json(response);
    }
  }

  static async batchDeleteTasks(req: Request, res: Response): Promise<void> {
    try {
      const { taskUuids } = req.body;

      await TaskService.batchDeleteTasks(taskUuids || []);

      const response: ResponseInterface = {
        success: true,
        message: "Tasks deleted successfully"
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Batch delete tasks error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to delete tasks"
      };

      res.status(400).json(response);
    }
  }

  static async getSolvedTasks(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user;
      const isAdmin = req.isAdmin || false;

      if (!user) {
        const response: ResponseInterface = {
          success: false,
          message: "Authentication required"
        };
        res.status(401).json(response);
        return;
      }

      // For regular users, only show their team's solved tasks
      const teamId = isAdmin ? undefined : user.teamId;

      if (!teamId && !isAdmin) {
        const response: ResponseInterface = {
          success: false,
          message: "User is not part of a team"
        };
        res.status(400).json(response);
        return;
      }

      const solvedTasks = await TaskService.getSolvedTasks(teamId ?? undefined);

      const response: ResponseInterface = {
        success: true,
        message: "Solved tasks retrieved successfully",
        data: solvedTasks
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Get solved tasks error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to retrieve solved tasks"
      };

      res.status(500).json(response);
    }
  }

  // refactored in 1.0.1
  /**
 * Get current user's solved tasks
 */
  static async getMySolvedTasks(req: Request, res: Response): Promise<void> {
    try {
      if (!req?.user?.teamId) return (res.status(s.FORBIDDEN).json({ success: false, message: "User is not part of a team" }), void 0);

      const solvedTasks = await TaskService.getSolvedTasks(req.user.teamId);

      res.status(s.OK).json({
        success: true,
        message: "Solved tasks retrieved successfully",
        data: solvedTasks
      });
    } catch (error: any) {
      logger.error("Get solved tasks error:", error);
      res.status(s.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error.message || "Failed to retrieve solved tasks"
      });
    }
  }

  /**
   * Get solved tasks by team (Admin only)
   */
  static async getSolvedTasksByTeam(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;

      if (typeof teamId != 'string') {
        const response: ResponseInterface = {
          success: false,
          message: "Bad request"
        };
        res.status(400).json(response);
        return;
      }

      if (!ValidationUtil.isValidUuid(teamId)) {
        const response: ResponseInterface = {
          success: false,
          message: "Invalid team UUID format"
        };
        res.status(400).json(response);
        return;
      }

      const solvedTasks = await TaskService.getSolvedTasks(teamId);

      const response: ResponseInterface = {
        success: true,
        message: "Solved tasks retrieved successfully",
        data: solvedTasks
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Get solved tasks by team error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to retrieve solved tasks"
      };

      res.status(500).json(response);
    }
  }
}

export default TaskController;