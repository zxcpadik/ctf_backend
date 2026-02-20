import { getTaskRepository, getFileRepository, getTaskGroupRepository, getSubmissionRepository } from './database.service';
import logger from '../services/logger.service';
import { Task } from '../entities/Task';
import { File } from '../entities/File';
import { TaskGroup } from '../entities/TaskGroup';
import ValidationUtil from '../utils/validation.util';
import UUIDUtil from '../utils/uuid.util';
import path from 'path';
import fs from 'fs/promises';
import Environment from '../config/environment';
import mime from 'mime-types'; // npm install mime-types
import GameService from './game.service';
import { GameStatus, Submission } from '../entities';
import EventEmitterService from './event-emitter.service';

export type TaskRelation = 'group' | 'files' | 'submissions';

/**
 * Service for managing CTF tasks and their associated files.
 */
class TaskService {
  /**
   * Admin-only: Creates a new task with associated files.
   * Files are stored in the file system and their metadata in the database.
   * @param {object} taskData - Object containing shortName, description, score, flag, groupId.
   * @param {Array<Express.Multer.File>} uploadFiles - Array of files uploaded via Multer.
   * @returns {Promise<Task>} The newly created task.
   */
  static async createTask(
    shortName: string,
    description: string | null,
    score: number,
    flag: string,
    groupId: string | undefined,
    uploadFiles: Array<Express.Multer.File> = []
  ): Promise<Task> {
    try {
      // Basic validation
      if (!ValidationUtil.isNonEmptyString(shortName) ||
        !ValidationUtil.isPositiveInteger(score) ||
        !ValidationUtil.isNonEmptyString(flag)) {
        throw new Error("Missing or invalid required task fields.");
      }
      if (groupId && !ValidationUtil.isValidUuid(groupId)) {
        throw new Error("Invalid task group UUID format.");
      }

      const taskRepository = getTaskRepository();
      const fileRepository = getFileRepository();
      const taskGroupRepository = getTaskGroupRepository();

      // Check for unique shortName
      const existingTask = await taskRepository.findOne({ where: { shortName } });
      if (existingTask) {
        throw new Error(`Task with short name '${shortName}' already exists.`);
      }

      let group: TaskGroup | null = null;
      if (groupId) {
        group = await taskGroupRepository.findOne({ where: { uuid: groupId } });
        if (!group) {
          throw new Error(`Task group with UUID '${groupId}' not found.`);
        }
      }

      const task = taskRepository.create({
        shortName,
        description,
        score,
        flag,
        isActive: (await GameService.getGameStatus()).status !== GameStatus.IN_PROCESS, // Active if game not running, otherwise inactive
        group: group,
        groupId: group ? group.uuid : null,
      });
      await taskRepository.save(task);

      // Handle file uploads
      const createdFiles: File[] = [];
      await fs.mkdir(Environment.TASK_FILES_PATH, { recursive: true }); // Ensure directory exists

      for (const uploadedFile of uploadFiles) {
        const fileUuid = UUIDUtil.generate();
        const filePath = path.join(Environment.TASK_FILES_PATH, fileUuid);
        await fs.rename(uploadedFile.path, filePath); // Move the file from temp storage

        const file = fileRepository.create({
          uuid: fileUuid,
          originalName: uploadedFile.originalname,
          mimeType: uploadedFile.mimetype || mime.lookup(uploadedFile.originalname) || 'application/octet-stream',
          path: fileUuid, // Relative path within TASK_FILES_PATH
          task: task,
          taskId: task.uuid,
          byte_size: uploadedFile.size
        });
        await fileRepository.save(file);
        createdFiles.push(file);
      }
      task.files = createdFiles; // Associate files
      await taskRepository.save(task); // Update task with file relations

      logger.info(`Task '${shortName}' (UUID: ${task.uuid}) created with ${createdFiles.length} files.`);
      EventEmitterService.emitTaskCreated(task);
      return task;
    } catch (error) {
      logger.error("Failed to create task:", error);
      throw error;
    }
  }

  /**
   * Retrieves a single task by its UUID.
   * Admins get full details (including flag), players only if active and game started.
   * @param {string} taskUuid - The UUID of the task.
   * @param {boolean} isAdmin - True if the requester is an admin.
   * @param {boolean} isGameActive - True if the game is currently active for players.
   * @returns {Promise<Task | null>} The task object or null if not found/accessible.
   */
  static async getTask(taskUuid: string, isAdmin: boolean, isGameActive: boolean): Promise<Task | null> {
    try {
      if (!ValidationUtil.isValidUuid(taskUuid)) {
        throw new Error("Invalid task UUID format.");
      }

      const taskRepository = getTaskRepository();
      const task = await taskRepository.findOne({
        where: { uuid: taskUuid },
        relations: ['files', 'group'], // Include group relation
      });

      if (!task) {
        return null; // Task not found
      }

      if (!isAdmin) {
        // Player logic
        if (!isGameActive) {
          return null; // Game not active, players can't see tasks
        }
        if (!task.isActive) {
          return null; // Task is inactive for players
        }
        // Check if task's group is active (if it has a group)
        if (task.group && !task.group.isActive) {
          return null; // Group is inactive, hide the task
        }
        // Sanitize sensitive info for players
        delete (task as any).flag; // Hide the flag
      }

      return task;
    } catch (error) {
      logger.error(`Failed to get task ${taskUuid}:`, error);
      throw error;
    }
  }

  static async getTaskById(taskId: string, relations: TaskRelation[] = []): Promise<Task | null> {
    try {
      const taskRepository = getTaskRepository();
      return await taskRepository.findOne({ where: { uuid: taskId }, relations });
    } catch (error) {
      logger.error(`Failed to get task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves all tasks. Admins get all details, players get active ones if game started.
   * @param {boolean} isAdmin - True if the requester is an admin.
   * @param {boolean} isGameActive - True if the game is currently active for players.
   * @returns {Promise<Task[]>} An array of task objects.
   */
  static async getAllTasks(isAdmin: boolean, isGameActive: boolean, include_group: boolean = true): Promise<Task[]> {
    try {
      const taskRepository = getTaskRepository();
      let tasks: Task[];

      if (isAdmin) {
        tasks = await taskRepository.find({
          relations: ['files', 'group'],
          order: { createdAt: 'DESC' }
        });
      } else {
        if (!isGameActive) {
          return []; // Game not active, players see no tasks
        }

        // For players, only show active tasks from active groups (or tasks without groups)
        let q = taskRepository
          .createQueryBuilder('task')
          .leftJoinAndSelect('task.files', 'files');
        if (include_group) q.leftJoinAndSelect('task.group', 'group');

        tasks = await q.leftJoinAndSelect('task.group', 'group')
          .where('task.isActive = :isActive', { isActive: true })
          .andWhere('(task.groupId IS NULL OR group.isActive = :groupActive)', {
            groupActive: true
          })
          .select([
            'task.uuid',
            'task.shortName',
            'task.description',
            'task.score',
            'task.isActive',
            'task.groupId',
            'task.createdAt',
            'task.updatedAt',
            'files',
            'group'
          ])
          .orderBy('task.createdAt', 'DESC')
          .getMany();

        // Ensure flag is removed even if select failed to exclude it
        tasks.forEach(task => delete (task as any).flag);
      }
      return tasks;
    } catch (error) {
      logger.error("Failed to get all tasks:", error);
      throw error;
    }
  }

  /**
   * Retrieves a file associated with a task.
   * Admins can download any file, players only if task is active and game started.
   * @param {string} fileUuid - The UUID of the file.
   * @param {boolean} isAdmin - True if the requester is an admin.
   * @param {boolean} isGameActive - True if the game is active for players.
   * @returns {Promise<{ filePath: string, originalName: string, mimeType: string } | null>} File path and metadata, or null.
   */
  static async getTaskFile(fileUuid: string, isAdmin: boolean, isGameActive: boolean): Promise<{ filePath: string, originalName: string, mimeType: string, byte_size: number } | null> {
    try {
      if (!ValidationUtil.isValidUuid(fileUuid)) {
        throw new Error("Invalid file UUID format.");
      }

      const fileRepository = getFileRepository();
      const file = await fileRepository.findOne({
        where: { uuid: fileUuid },
        relations: ['task'],
      });

      if (!file || !file.task) {
        return null; // File or associated task not found
      }

      if (!isAdmin) {
        // Player logic
        if (!isGameActive) {
          return null; // Game not active, players can't download files
        }
        if (!file.task.isActive) {
          return null; // Task is inactive, players can't download files
        }
        if (file.task.group && !file.task.group.isActive) {
          return null; // Group is inactive, hide the file
        }
      }

      const absolutePath = path.join(Environment.TASK_FILES_PATH, file.path);
      // Verify file exists on disk
      try {
        await fs.access(absolutePath, fs.constants.F_OK);
      } catch (err) {
        logger.error(`File not found on disk: ${absolutePath}`);
        return null;
      }

      return {
        filePath: absolutePath,
        originalName: file.originalName,
        mimeType: file.mimeType,
        byte_size: file.byte_size
      };
    } catch (error) {
      logger.error(`Failed to get task file ${fileUuid}:`, error);
      throw error;
    }
  }

  /**
   * Admin-only: Updates an existing task.
   * @param {string} taskUuid - UUID of the task to update.
   * @param {object} updateData - Partial task data (shortName, description, score, flag, groupId, isActive).
   * @param {Array<Express.Multer.File>} newUploadFiles - New files to add.
   * @param {string[]} filesToDelete - UUIDs of existing files to remove.
   * @returns {Promise<Task>} The updated task.
   */
  static async updateTask(
    taskUuid: string,
    updateData: { shortName?: string, description?: string, score?: number, flag?: string, groupId?: string | null, isActive?: boolean },
    newUploadFiles: Array<Express.Multer.File> = [],
    filesToDelete: string[] = []
  ): Promise<Task> {
    try {
      if (!ValidationUtil.isValidUuid(taskUuid)) {
        throw new Error("Invalid task UUID format.");
      }

      const taskRepository = getTaskRepository();
      const fileRepository = getFileRepository();
      const taskGroupRepository = getTaskGroupRepository();

      const task = await taskRepository.findOne({
        where: { uuid: taskUuid },
        relations: ['files'],
      });

      if (!task) {
        throw new Error("Task not found.");
      }

      // Handle group update
      if (updateData.groupId !== undefined) {
        if (updateData.groupId === null || updateData.groupId === "null") { // Explicitly set to no group
          (task as any).group = null;
          task.groupId = null;
        } else if (ValidationUtil.isValidUuid(updateData.groupId)) {
          const group = await taskGroupRepository.findOne({ where: { uuid: updateData.groupId } });
          if (!group) {
            throw new Error(`Task group with UUID '${updateData.groupId}' not found.`);
          }
          task.group = group;
          task.groupId = group.uuid;
        } else {
          throw new Error("Invalid format for groupId.");
        }
      }

      // Update basic fields
      if (updateData.shortName !== undefined) {
        if (!ValidationUtil.isNonEmptyString(updateData.shortName)) throw new Error("Short name cannot be empty.");
        const existingTask = await taskRepository.findOne({ where: { shortName: updateData.shortName } });
        if (existingTask && existingTask.uuid !== task.uuid) {
          throw new Error(`Task with short name '${updateData.shortName}' already exists.`);
        }
        task.shortName = updateData.shortName;
      }
      if (updateData.description !== undefined) {
        task.description = ((updateData.description === "null") ? null : updateData.description);
      }
      if (updateData.score !== undefined) {
        if (!ValidationUtil.isPositiveInteger(updateData.score)) throw new Error("Score must be a positive integer.");
        task.score = updateData.score;
      }
      if (updateData.flag !== undefined) {
        if (!ValidationUtil.isNonEmptyString(updateData.flag)) throw new Error("Flag cannot be empty.");
        task.flag = updateData.flag;
      }
      if (updateData.isActive !== undefined) {
        task.isActive = updateData.isActive;
      }

      await taskRepository.save(task);

      // Handle files to delete
      for (const fileUuidToDelete of filesToDelete) {
        const fileToRemove = task.files.find(f => f.uuid === fileUuidToDelete);
        if (fileToRemove) {
          const absolutePath = path.join(Environment.TASK_FILES_PATH, fileToRemove.path);
          try {
            await fs.unlink(absolutePath); // Delete from disk
            await fileRepository.remove(fileToRemove); // Delete from DB
            task.files = task.files.filter(f => f.uuid !== fileUuidToDelete); // Update in-memory list
            logger.info(`File ${fileToRemove.uuid} deleted from task ${task.uuid}.`);
          } catch (err) {
            logger.warn(`Failed to delete file ${fileToRemove.uuid} from disk: ${(err as any)?.message}`);
          }
        }
      }

      // Handle new file uploads
      await fs.mkdir(Environment.TASK_FILES_PATH, { recursive: true });
      for (const uploadedFile of newUploadFiles) {
        const fileUuid = UUIDUtil.generate();
        const filePath = path.join(Environment.TASK_FILES_PATH, fileUuid);
        await fs.rename(uploadedFile.path, filePath);

        const newFile = fileRepository.create({
          uuid: fileUuid,
          originalName: uploadedFile.originalname,
          mimeType: uploadedFile.mimetype || mime.lookup(uploadedFile.originalname) || 'application/octet-stream',
          path: fileUuid,
          task: task,
          taskId: task.uuid,
          byte_size: uploadedFile.size,
        });
        await fileRepository.save(newFile);
        task.files.push(newFile); // Add to in-memory list
        logger.info(`New file ${newFile.uuid} added to task ${task.uuid}.`);
      }

      logger.info(`Task '${task.shortName}' (UUID: ${task.uuid}) updated.`);
      EventEmitterService.emitTaskUpdated(task);
      return task;
    } catch (error) {
      logger.error(`Failed to update task ${taskUuid}:`, error);
      throw error;
    }
  }

  /**
   * Admin-only: Deletes a task and its associated files from disk and database.
   * @param {string} taskUuid - The UUID of the task to delete.
   * @returns {Promise<void>}
   */
  static async deleteTask(taskUuid: string): Promise<void> {
    try {
      if (!ValidationUtil.isValidUuid(taskUuid)) {
        throw new Error("Invalid task UUID format.");
      }

      const taskRepository = getTaskRepository();

      const task = await taskRepository.findOne({
        where: { uuid: taskUuid },
        relations: ['files'],
      });

      if (!task) {
        throw new Error("Task not found.");
      }

      // Delete associated files from disk
      for (const file of task.files) {
        const absolutePath = path.join(Environment.TASK_FILES_PATH, file.path);
        try {
          await fs.unlink(absolutePath);
          logger.info(`Deleted file ${file.uuid} from disk.`);
        } catch (err) {
          logger.warn(`Failed to delete file ${file.uuid} from disk: ${(err as any)?.message}`);
        }
      }

      let uuid = task.uuid; // TODO not sure that .remove keep fields :)
      await taskRepository.remove(task);
      EventEmitterService.emitTaskDeleted(uuid);
      logger.info(`Task '${task.shortName}' (UUID: ${task.uuid}) and its files deleted.`);
    } catch (error) {
      logger.error(`Failed to delete task ${taskUuid}:`, error);
      throw error;
    }
  }

  /**
   * Admin-only: Batch update the active status of multiple tasks.
   * If `taskUuids` is empty, all tasks are affected.
   * @param {string[]} taskUuids - Array of task UUIDs to update. If empty, apply to all.
   * @param {boolean} isActive - The new active status to set.
   * @returns {Promise<void>}
   */
  static async batchUpdateTaskActiveStatus(taskUuids: string[], isActive: boolean): Promise<void> {
    try {
      const taskRepository = getTaskRepository();
      const taskGroupRepository = getTaskGroupRepository();

      if (taskUuids.length === 0) {
        // Update all tasks
        if (isActive) {
          // For activation, activate all tasks and their groups if needed
          const tasksToActivate = await taskRepository.find({
            where: { isActive: false },
            relations: ['group']
          });

          // First activate all tasks
          await taskRepository.update({}, { isActive: true });

          // Then activate groups for tasks that were inactive and have inactive groups
          const groupsToActivate = new Set<string>();
          tasksToActivate.forEach(task => {
            if (task.group && !task.group.isActive) {
              groupsToActivate.add(task.group.uuid);
            }
          });

          // Activate the groups
          for (const groupId of groupsToActivate) {
            await taskGroupRepository.update({ uuid: groupId }, { isActive: true });
          }

          logger.info(`Activated all tasks and ${groupsToActivate.size} groups.`);
        } else {
          // For deactivation, just deactivate all tasks (don't touch groups)
          await taskRepository.update({}, { isActive: false });
          logger.info(`Deactivated all tasks.`);
        }
      } else {
        // Update specific tasks
        const groupsToActivate = new Set<string>();

        for (const uuid of taskUuids) {
          if (!ValidationUtil.isValidUuid(uuid)) {
            logger.warn(`Skipping invalid task UUID during batch update: ${uuid}`);
            continue;
          }

          const task = await taskRepository.findOne({
            where: { uuid: uuid },
            relations: ['group']
          });

          if (task) {
            // Store old active status
            const oldIsActive = task.isActive;

            // Update the task
            await taskRepository.update({ uuid: uuid }, { isActive: isActive });

            // If activating and the task has an inactive group, mark group for activation
            if (isActive && !oldIsActive && task.group && !task.group.isActive) {
              groupsToActivate.add(task.group.uuid);
            }
          }
        }

        // Activate the groups that need it
        for (const groupId of groupsToActivate) {
          await taskGroupRepository.update({ uuid: groupId }, { isActive: true });
        }

        logger.info(`Batch updated ${taskUuids.length} tasks to isActive: ${isActive} and activated ${groupsToActivate.size} groups.`);
      }

      EventEmitterService.emitTaskDescync();
    } catch (error) {
      logger.error("Failed to batch update task active status:", error);
      throw error;
    }
  }

  /**
   * Admin-only: Batch delete multiple tasks.
   * @param {string[]} taskUuids - Array of task UUIDs to delete.
   * @returns {Promise<void>}
   */
  static async batchDeleteTasks(taskUuids: string[]): Promise<void> {
    try {
      for (const uuid of taskUuids) {
        if (!ValidationUtil.isValidUuid(uuid)) {
          logger.warn(`Skipping invalid task UUID during batch delete: ${uuid}`);
          continue;
        }
        await TaskService.deleteTask(uuid); // Re-use single delete logic to handle files
      }
      logger.info(`Batch deleted ${taskUuids.length} tasks.`);
    } catch (error) {
      logger.error("Failed to batch delete tasks:", error);
      throw error;
    }
  }

  /**
   * Admin-only: Creates a new task group.
   * @param {string} name - The name of the group.
   * @param {string} description - The description of the group.
   * @returns {Promise<TaskGroup>} The newly created task group.
   */
  static async createTaskGroup(name: string, description: string): Promise<TaskGroup> {
    try {
      if (!ValidationUtil.isNonEmptyString(name)) {
        throw new Error("Group name cannot be empty.");
      }
      const taskGroupRepository = getTaskGroupRepository();
      const existingGroup = await taskGroupRepository.findOne({ where: { name } });
      if (existingGroup) {
        throw new Error(`Task group with name '${name}' already exists.`);
      }
      const newGroup = taskGroupRepository.create({ name, description });
      await taskGroupRepository.save(newGroup);
      logger.info(`Task group '${name}' (UUID: ${newGroup.uuid}) created.`);
      return newGroup;
    } catch (error) {
      logger.error("Failed to create task group:", error);
      throw error;
    }
  }

  /**
   * Admin-only: Updates an existing task group.
   * @param {string} groupUuid - The UUID of the group to update.
   * @param {object} updateData - Partial group data (name, description).
   * @returns {Promise<TaskGroup>} The updated task group.
   */
  static async updateTaskGroup(groupUuid: string, updateData: { name?: string, description?: string }): Promise<TaskGroup> {
    try {
      if (!ValidationUtil.isValidUuid(groupUuid)) {
        throw new Error("Invalid group UUID format.");
      }
      const taskGroupRepository = getTaskGroupRepository();
      const group = await taskGroupRepository.findOne({ where: { uuid: groupUuid } });
      if (!group) {
        throw new Error("Task group not found.");
      }

      if (updateData.name !== undefined) {
        if (!ValidationUtil.isNonEmptyString(updateData.name)) throw new Error("Group name cannot be empty.");
        const existingGroup = await taskGroupRepository.findOne({ where: { name: updateData.name } });
        if (existingGroup && existingGroup.uuid !== group.uuid) {
          throw new Error(`Task group with name '${updateData.name}' already exists.`);
        }
        group.name = updateData.name;
      }
      if (updateData.description !== undefined) {
        group.description = updateData.description;
      }
      await taskGroupRepository.save(group);
      logger.info(`Task group '${group.name}' (UUID: ${group.uuid}) updated.`);
      return group;
    } catch (error) {
      logger.error(`Failed to update task group ${groupUuid}:`, error);
      throw error;
    }
  }

  /**
   * Admin-only: Deletes a task group. Tasks associated with this group will have their groupId set to null.
   * @param {string} groupUuid - The UUID of the group to delete.
   * @returns {Promise<void>}
   */
  static async deleteTaskGroup(groupUuid: string): Promise<void> {
    try {
      if (!ValidationUtil.isValidUuid(groupUuid)) {
        throw new Error("Invalid group UUID format.");
      }
      const taskGroupRepository = getTaskGroupRepository();
      const group = await taskGroupRepository.findOne({ where: { uuid: groupUuid } });
      if (!group) {
        throw new Error("Task group not found.");
      }

      // Tasks associated with this group will have their groupId set to null due to onDelete: 'SET NULL' on Task entity
      await taskGroupRepository.remove(group);
      logger.info(`Task group '${group.name}' (UUID: ${group.uuid}) deleted.`);
    } catch (error) {
      logger.error(`Failed to delete task group ${groupUuid}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves all task groups.
   * @returns {Promise<TaskGroup[]>} An array of task groups.
   */
  static async getAllTaskGroups(): Promise<TaskGroup[]> {
    try {
      const taskGroupRepository = getTaskGroupRepository();
      return await taskGroupRepository.find();
    } catch (error) {
      logger.error("Failed to get all task groups:", error);
      throw error;
    }
  }

  /**
   * Gets all solved tasks for a specific team, or all solved tasks if no teamId provided (admin only).
   * @param {string} teamId - Optional team UUID to filter by.
   * @returns {Promise<any[]>} Array of solved task information with submission details.
   */
  static async getSolvedTasks(teamId?: string): Promise<Submission[]> {
    try {
      const submissionRepository = getSubmissionRepository();

      let query = submissionRepository
        .createQueryBuilder('submission')
        .leftJoinAndSelect('submission.task', 'task')
        .leftJoinAndSelect('submission.user', 'user')
        .leftJoinAndSelect('submission.team', 'team')
        .where('submission.isCorrect = :isCorrect', { isCorrect: true });

      if (teamId) query = query.andWhere('submission.teamId = :teamId', { teamId });

      const submissions = await query
        .orderBy('submission.timestamp', 'ASC')
        .getMany();

      // Group by task to get first solve information
      const solvedTasksMap = new Map();

      for (const submission of submissions) {
        const taskId = submission.taskId;

        if (!solvedTasksMap.has(taskId)) {
          solvedTasksMap.set(taskId, {
            taskId: submission.task.uuid,
            taskName: submission.task.shortName,
            score: submission.task.score,
            solvedBy: submission.user.name,
            solvedByUserId: submission.user.uuid,
            teamId: submission.team.uuid,
            teamName: submission.team.name,
            solvedAt: submission.timestamp
          });
        }
      }

      return Array.from(solvedTasksMap.values());
    } catch (error) {
      logger.error("Failed to get solved tasks:", error);
      throw error;
    }
  }

  /**
   * Gets statistics about task solves across all teams.
   * Admin only - useful for analyzing task difficulty and team progress.
   * @returns {Promise<any[]>} Array of tasks with solve statistics.
   */
  static async getTaskSolveStatistics(): Promise<any[]> {
    try {
      const submissionRepository = getSubmissionRepository();
      const taskRepository = getTaskRepository();

      const tasks = await taskRepository.find({
        order: { createdAt: 'ASC' }
      });

      const statistics = [];

      for (const task of tasks) {
        const correctSubmissions = await submissionRepository
          .createQueryBuilder('submission')
          .leftJoinAndSelect('submission.team', 'team')
          .leftJoinAndSelect('submission.user', 'user')
          .where('submission.taskId = :taskId', { taskId: task.uuid })
          .andWhere('submission.isCorrect = :isCorrect', { isCorrect: true })
          .orderBy('submission.timestamp', 'ASC')
          .getMany();

        const totalAttempts = await submissionRepository.count({
          where: { taskId: task.uuid }
        });

        const firstSolve = correctSubmissions.length > 0 ? correctSubmissions[0] : null;

        statistics.push({
          taskId: task.uuid,
          taskName: task.shortName,
          score: task.score,
          isActive: task.isActive,
          solveCount: correctSubmissions.length,
          totalAttempts,
          firstSolve: firstSolve ? {
            teamName: firstSolve.team.name,
            userName: firstSolve.user.name,
            timestamp: firstSolve.timestamp
          } : null,
          solves: correctSubmissions.map(sub => ({
            teamName: sub.team.name,
            userName: sub.user.name,
            timestamp: sub.timestamp
          }))
        });
      }

      return statistics;
    } catch (error) {
      logger.error("Failed to get task solve statistics:", error);
      throw error;
    }
  }
}

export default TaskService;