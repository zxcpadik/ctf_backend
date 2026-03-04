import { Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import TaskService from '../services/task.service';
import logger from '../services/logger.service';
import MyError from '../utils/myerror.util';

// Multer — temp storage, moved to permanent path by TaskService
const upload = multer({ dest: './uploads/tmp/', limits: { files: 30 } });

export const upload_files: RequestHandler     = upload.array('files', 30);
export const upload_new_files: RequestHandler = upload.array('new_files', 30);

class TaskController {
  /**
   * GET /tasks
   * Admin: all tasks with files and group.
   * User:  active tasks from active groups only, flag stripped.
   */
  static async get_all(req: Request, res: Response): Promise<void> {
    try {
      const tasks = await TaskService.get_all(['files', 'group']);

      const data = req.is_admin ? tasks : tasks
        .filter(t => t.is_active && (!t.group || t.group.is_active))
        .map(({ flag: _flag, ...t }) => t);

      res.status(200).json({ success: true, data });
    } catch (error: any) {
      logger.error("Get all tasks error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /tasks/:task_uuid
   * Admin: full task including flag.
   * User:  only if task and its group are active, flag stripped.
   */
  static async get(req: Request, res: Response): Promise<void> {
    try {
      const task = await TaskService.get(req.params.task_uuid, ['files', 'group']);

      if (!task) {
        res.status(404).json({ success: false, message: "Task not found" });
        return;
      }

      if (!req.is_admin) {
        if (!task.is_active || (task.group && !task.group.is_active)) {
          res.status(404).json({ success: false, message: "Task not found" });
          return;
        }
        const { flag: _flag, ...safe } = task as any;
        res.status(200).json({ success: true, data: safe });
        return;
      }

      res.status(200).json({ success: true, data: task });
    } catch (error: any) {
      logger.error("Get task error:", error);
      res.status(error instanceof MyError ? (error.code || 500) : 500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /tasks
   * Admin only. Multipart form — files attached as 'files'.
   */
  static async create(req: Request, res: Response): Promise<void> {
    upload_files(req, res, async (err) => {
      if (err) {
        res.status(400).json({ success: false, message: "File upload failed" });
        return;
      }
      try {
        const { short_name, description, score, flag, group_uuid } = req.body;
        const files = (req.files ?? []) as Express.Multer.File[];

        const task = await TaskService.create(
          short_name,
          description ?? null,
          parseInt(score),
          flag,
          group_uuid,
          files,
        );

        res.status(201).json({ success: true, data: { task_uuid: task.uuid } });
      } catch (error: any) {
        logger.error("Create task error:", error);
        res.status(error instanceof MyError ? (error.code || 500) : 400).json({ success: false, message: error.message });
      }
    });
  }

  /**
   * PUT /tasks/:task_uuid
   * Admin only. Multipart form — new files attached as 'new_files',
   * files_to_delete as JSON array string in body.
   */
  static async update(req: Request, res: Response): Promise<void> {
    upload_new_files(req, res, async (err) => {
      if (err) {
        res.status(400).json({ success: false, message: "File upload failed" });
        return;
      }
      try {
        const { short_name, description, score, flag, group_uuid, is_active, files_to_delete } = req.body;
        const files_to_upload_arr = (req.files ?? []) as Express.Multer.File[];
        const files_to_delete_arr: string[] = files_to_delete ? JSON.parse(files_to_delete) : [];

        const task = await TaskService.update(
          req.params.task_uuid as string, {
            short_name,
            description,
            score: score ? parseInt(score) : undefined,
            flag,
            group_uuid: group_uuid !== undefined ? (group_uuid === 'null' ? null : group_uuid) : undefined,
            is_active: is_active !== undefined  ? is_active === 'true'   : undefined,
          },
          files_to_upload_arr,
          files_to_delete_arr,
        );

        res.status(200).json({ success: true, data: task });
      } catch (error: any) {
        logger.error("Update task error:", error);
        res.status(error instanceof MyError ? (error.code || 500) : 400).json({ success: false, message: error.message });
      }
    });
  }

  /**
   * DELETE /tasks/:task_uuid
   * Admin only.
   */
  static async delete(req: Request, res: Response): Promise<void> {
    try {
      await TaskService.delete(req.params.task_uuid);
      res.status(200).json({ success: true, message: "Task deleted successfully" });
    } catch (error: any) {
      logger.error("Delete task error:", error);
      res.status(error instanceof MyError ? (error.code || 500) : 400).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /tasks/files/:file_uuid
   * Admin: any file. User: only if task and its group are active.
   */
  static async download_file(req: Request, res: Response): Promise<void> {
    try {
      const file_info = await TaskService.get_file(req.params.file_uuid);

      if (!file_info) {
        res.status(404).json({ success: false, message: "File not found" });
        return;
      }

      if (!req.is_admin) {
        const task = file_info.task;
        if (!task.is_active || (task.group && !task.group.is_active)) {
          res.status(404).json({ success: false, message: "File not found" });
          return;
        }
      }

      res.download(file_info.file_path, file_info.original_name, (err) => {
        if (err && !res.headersSent) {
          logger.error("File download error:", err);
          res.status(500).json({ success: false, message: "Failed to send file" });
        }
      });
    } catch (error: any) {
      logger.error("Download file error:", error);
      res.status(error instanceof MyError ? (error.code || 500) : 500).json({ success: false, message: error.message });
    }
  }
}

export { TaskController };
export default TaskController;