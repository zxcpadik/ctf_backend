import { getTaskRepository, getFileRepository, getTaskGroupRepository } from './database.service';
import logger from './logger.service';
import { Task } from '../entities/Task';
import { File } from '../entities/File';
import ValidationUtil from '../utils/validation.util';
import UUIDUtil from '../utils/uuid.util';
import path from 'path';
import fs from 'fs/promises';
import Environment from '../config/environment';
import mime from 'mime-types';
import MyError from '../utils/myerror.util';
import s from "http-status";
import ConfigService from './config.service';

export type TaskRelation = 'group' | 'files' | 'submissions';

class TaskService {
  /**
   * Create a new task with associated files.
   */
  static async create(
    short_name: string,
    description: string | null,
    score: number,
    flag: string,
    group_uuid?: string,
    upload_files: Array<Express.Multer.File> = []
  ): Promise<Task> {
    try {
      if (!ValidationUtil.isNonEmptyString(short_name)) throw new MyError("Short name cannot be empty", { code: s.UNPROCESSABLE_ENTITY });
      if (!ValidationUtil.isPositiveInteger(score)) throw new MyError("Score must be a positive integer", { code: s.UNPROCESSABLE_ENTITY });
      if (!ValidationUtil.isNonEmptyString(flag)) throw new MyError("Flag cannot be empty", { code: s.UNPROCESSABLE_ENTITY });
      if (group_uuid && !ValidationUtil.isValidUuid(group_uuid)) throw new MyError("Invalid task group UUID", { code: s.BAD_REQUEST });

      const task_repo = getTaskRepository();
      const file_repo = getFileRepository();
      const task_group_repo = getTaskGroupRepository();

      const is_name_taken = await task_repo.exists({ where: { short_name } });
      if (is_name_taken) throw new MyError(`Task with short name '${short_name}' already exists`, { code: s.CONFLICT });

      let group = null;
      if (group_uuid) {
        group = await task_group_repo.findOne({ where: { uuid: group_uuid } });
        if (!group) throw new MyError(`Task group with UUID '${group_uuid}' not found`, { code: s.NOT_FOUND });
      }

      const is_game_running = (await ConfigService.get_value("game_state")) == "running"; // scheduled, ended, running, paused
      const task = task_repo.create({
        short_name,
        description,
        score,
        flag,
        is_active: !is_game_running,
        group,
        group_uuid: group ? group.uuid : null,
      });
      await task_repo.save(task);

      // Handle file uploads
      const created_files: File[] = [];
      await fs.mkdir(Environment.TASK_FILES_PATH, { recursive: true });

      for (const uploaded_file of upload_files) {
        const file_uuid = UUIDUtil.generate();
        const file_path = path.join(Environment.TASK_FILES_PATH, file_uuid);
        await fs.rename(uploaded_file.path, file_path);

        const file = file_repo.create({
          uuid: file_uuid,
          original_name: uploaded_file.originalname,
          mime_type: uploaded_file.mimetype || mime.lookup(uploaded_file.originalname) || 'application/octet-stream',
          path: file_uuid,
          task,
          task_uuid: task.uuid,
          byte_size: uploaded_file.size,
        });
        await file_repo.save(file);
        created_files.push(file);
      }

      task.files = created_files;
      await task_repo.save(task);

      logger.info(`Task '${short_name}' created with UUID: ${task.uuid} and ${created_files.length} file(s)`);
      return task;
    } catch (error) {
      logger.error("Failed to create task:", error);
      throw error;
    }
  }

  /**
   * Get all tasks.
   */
  static async get_all(relations: TaskRelation[] = []): Promise<Task[]> {
    try {
      const task_repo = getTaskRepository();
      return await task_repo.find({
        relations,
        order: { created_at: 'DESC' },
      });
    } catch (error) {
      logger.error("Failed to get all tasks:", error);
      throw error;
    }
  }

  /**
   * Get a specific task by UUID.
   */
  static async get(task_uuid: any, relations: TaskRelation[] = []): Promise<Task | null> {
    try {
      if (!ValidationUtil.isValidUuid(task_uuid)) throw new MyError("Invalid task UUID", { code: s.BAD_REQUEST });

      const task_repo = getTaskRepository();
      return await task_repo.findOne({ where: { uuid: task_uuid }, relations });
    } catch (error) {
      logger.error(`Failed to get task ${task_uuid}:`, error);
      throw error;
    }
  }

  /**
   * Get a file associated with a task by file UUID.
   */
  static async get_file(file_uuid: any): Promise<{ file_path: string, original_name: string, mime_type: string, byte_size: number, task: Task, task_uuid: string } | null> {
    try {
      if (!ValidationUtil.isValidUuid(file_uuid)) throw new MyError("Invalid file UUID", { code: s.BAD_REQUEST });

      const file_repo = getFileRepository();
      const file = await file_repo.findOne({
        where: { uuid: file_uuid },
        relations: ['task', 'task.group'],
      });

      if (!file || !file.task) throw new MyError("File not found", { code: s.NOT_FOUND });

      const absolute_path = path.join(Environment.TASK_FILES_PATH, file.path);
      try {
        await fs.access(absolute_path, fs.constants.F_OK);
      } catch {
        logger.error(`File not found on disk: ${absolute_path}`);
        throw new MyError("File not found on disk", { code: s.NOT_FOUND });
      }

      return {
        file_path: absolute_path,
        original_name: file.original_name,
        mime_type: file.mime_type,
        byte_size: file.byte_size,
        task: file.task,
        task_uuid: file.task_uuid,
      };
    } catch (error) {
      logger.error(`Failed to get task file ${file_uuid}:`, error);
      throw error;
    }
  }

  /**
   * Update an existing task.
   */
  static async update(
    task_uuid: string | Task,
    update_data: { short_name?: string, description?: string | null, score?: number, flag?: string, group_uuid?: string | null, is_active?: boolean, is_case_sensitive?: boolean },
    files_to_upload: Array<Express.Multer.File> = [],
    files_to_delete: string[] = []
  ): Promise<Task> {
    try {
      if (typeof task_uuid == "string" && !ValidationUtil.isValidUuid(task_uuid)) throw new MyError("Invalid task reference", { code: s.BAD_REQUEST });

      const task_repo = getTaskRepository();
      const file_repo = getFileRepository();
      const task_group_repo = getTaskGroupRepository();

      const task = typeof task_uuid == "string" ? (await task_repo.findOne({ where: { uuid: task_uuid }, relations: ['files'] })) : task_uuid;
      if (!task) throw new MyError("Task not found", { code: s.NOT_FOUND });

      // Handle group update
      if (update_data.group_uuid !== undefined) {
        if (update_data.group_uuid === null) {
          task.group = null;
          task.group_uuid = null;
        } else {
          if (!ValidationUtil.isValidUuid(update_data.group_uuid)) throw new MyError("Invalid group UUID", { code: s.BAD_REQUEST });
          const group = await task_group_repo.findOne({ where: { uuid: update_data.group_uuid } });
          if (!group) throw new MyError(`Task group with UUID '${update_data.group_uuid}' not found`, { code: s.NOT_FOUND });
          task.group = group;
          task.group_uuid = group.uuid;
        }
      }

      if (update_data.short_name !== undefined) {
        if (!ValidationUtil.isNonEmptyString(update_data.short_name)) throw new MyError("Short name cannot be empty", { code: s.UNPROCESSABLE_ENTITY });
        const existing_task = await task_repo.findOne({ where: { short_name: update_data.short_name } });
        if (existing_task && existing_task.uuid !== task.uuid) throw new MyError(`Task with short name '${update_data.short_name}' already exists`, { code: s.CONFLICT });
        task.short_name = update_data.short_name;
      }
      if (update_data.description !== undefined) task.description = update_data.description;
      if (update_data.score !== undefined) {
        if (!ValidationUtil.isPositiveInteger(update_data.score)) throw new MyError("Score must be a positive integer", { code: s.UNPROCESSABLE_ENTITY });
        task.score = update_data.score;
      }
      if (update_data.flag !== undefined) {
        if (!ValidationUtil.isNonEmptyString(update_data.flag)) throw new MyError("Flag cannot be empty", { code: s.UNPROCESSABLE_ENTITY });
        task.flag = update_data.flag;
      }
      if (update_data.is_active !== undefined) task.is_active = update_data.is_active;
      if (update_data.is_case_sensitive !== undefined) task.is_case_sensitive = update_data.is_case_sensitive;

      await task_repo.save(task);

      // Handle file deletions
      for (const file_uuid_to_delete of files_to_delete) {
        const file_to_remove = task.files.find(f => f.uuid === file_uuid_to_delete);
        if (file_to_remove) {
          const absolute_path = path.join(Environment.TASK_FILES_PATH, file_to_remove.path);
          try {
            await fs.unlink(absolute_path);
            await file_repo.remove(file_to_remove);
            task.files = task.files.filter(f => f.uuid !== file_uuid_to_delete);
            logger.info(`File ${file_to_remove.uuid} deleted from task ${task.uuid}`);
          } catch (err) {
            logger.warn(`Failed to delete file ${file_to_remove.uuid} from disk: ${(err as any)?.message}`);
          }
        }
      }

      // Handle new file uploads
      await fs.mkdir(Environment.TASK_FILES_PATH, { recursive: true }); // TODO should be handled by initializer
      for (const uploaded_file of files_to_upload) {
        const file_uuid = UUIDUtil.generate();
        const file_path = path.join(Environment.TASK_FILES_PATH, file_uuid);
        await fs.rename(uploaded_file.path, file_path);

        const new_file = file_repo.create({
          uuid: file_uuid,
          original_name: uploaded_file.originalname,
          mime_type: uploaded_file.mimetype || mime.lookup(uploaded_file.originalname) || 'application/octet-stream',
          path: file_uuid,
          task,
          task_uuid: task.uuid,
          byte_size: uploaded_file.size,
        });
        await file_repo.save(new_file);
        task.files.push(new_file);
        logger.info(`File ${new_file.uuid} added to task ${task.uuid}`);
      }

      logger.info(`Task '${task.short_name}' (UUID: ${task.uuid}) updated`);
      return task;
    } catch (error) {
      logger.error(`Failed to update task ${typeof task_uuid == "string" ? task_uuid : task_uuid?.uuid}:`, error);
      throw error;
    }
  }

  /**
   * Delete a task and all its associated files from disk and database.
   */
  static async delete(task_uuid: any | Task): Promise<void> {
    try {
      if (typeof task_uuid == "string" && !ValidationUtil.isValidUuid(task_uuid)) throw new MyError("Invalid task reference", { code: s.BAD_REQUEST });

      const task_repo = getTaskRepository();
      const task = typeof task_uuid == "string" ? (await task_repo.findOne({ where: { uuid: task_uuid }, relations: ['files'] })) : task_uuid;
      if (!task) throw new MyError("Task not found", { code: s.NOT_FOUND });

      for (const file of task.files) {
        // TODO ! CONSIDER CREATING FILESERVICE WITH ALIASED DELETE FUNCTION
        const absolute_path = path.join(Environment.TASK_FILES_PATH, file.path);
        try {
          await fs.unlink(absolute_path);
          logger.info(`Deleted file ${file.uuid} from disk`);
        } catch (err) {
          logger.warn(`Failed to delete file ${file.uuid} from disk: ${(err as any)?.message}`);
        }
      }

      await task_repo.remove(task);
      logger.info(`Task '${task.short_name}' (UUID: ${task.uuid}) and its files deleted`);
    } catch (error) {
      logger.error(`Failed to delete task ${typeof task_uuid == "string" ? task_uuid : task_uuid?.uuid}:`, error);
      throw error;
    }
  }
}

export { TaskService };
export default TaskService;