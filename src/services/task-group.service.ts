import { getTaskGroupRepository, getTaskRepository } from './database.service';
import logger from './logger.service';
import { TaskGroup } from '../entities/TaskGroup';
import { Task } from '../entities/Task';
import ValidationUtil from '../utils/validation.util';

class TaskGroupService {
  /**
   * Create a new task group
   */
  static async createTaskGroup(name: string, description?: string): Promise<TaskGroup> {
    try {
      if (!ValidationUtil.isNonEmptyString(name)) {
        throw new Error("Group name cannot be empty.");
      }

      const taskGroupRepository = getTaskGroupRepository();

      // Check if group name already exists
      const existingGroup = await taskGroupRepository.findOne({ where: { name } });
      if (existingGroup) {
        throw new Error(`Task group with name '${name}' already exists.`);
      }

      const newGroup = taskGroupRepository.create({
        name,
        description: description || null,
      });

      await taskGroupRepository.save(newGroup);
      logger.info(`Task group '${name}' created with UUID: ${newGroup.uuid}`);
      return newGroup;
    } catch (error) {
      logger.error("Failed to create task group:", error);
      throw error;
    }
  }

  /**
   * Get all task groups with their tasks
   */
  static async getAllTaskGroups(includeTasks: boolean = true, isGameActive: boolean = false, isAdmin: boolean = false): Promise<TaskGroup[]> {
    try {
      if (!isAdmin && !isGameActive) {
        return [];
      }

      const taskGroupRepository = getTaskGroupRepository();
      const relations = includeTasks ? ['tasks'] : [];

      return await taskGroupRepository.find({
        relations,
        order: {
          name: 'ASC',
          createdAt: 'DESC'
        }
      });
    } catch (error) {
      logger.error("Failed to get all task groups:", error);
      throw error;
    }
  }

  /**
   * Get a specific task group by ID
   */
  static async getTaskGroupById(groupId: string, includeTasks: boolean = true): Promise<TaskGroup | null> {
    try {
      if (!ValidationUtil.isValidUuid(groupId)) {
        throw new Error("Invalid group UUID format.");
      }

      const taskGroupRepository = getTaskGroupRepository();
      const relations = includeTasks ? ['tasks'] : [];

      return await taskGroupRepository.findOne({
        where: { uuid: groupId },
        relations
      });
    } catch (error) {
      logger.error(`Failed to get task group ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Update a task group
   */
  static async updateTaskGroup(groupId: string, updateData: { name?: string; description?: string; isActive?: boolean }): Promise<TaskGroup> {
    try {
      if (!ValidationUtil.isValidUuid(groupId)) {
        throw new Error("Invalid group UUID format.");
      }

      const taskGroupRepository = getTaskGroupRepository();
      const group = await taskGroupRepository.findOne({ where: { uuid: groupId } });

      if (!group) {
        throw new Error("Task group not found.");
      }

      const oldIsActive = group.isActive;

      if (updateData.name !== undefined) {
        if (!ValidationUtil.isNonEmptyString(updateData.name)) {
          throw new Error("Group name cannot be empty.");
        }

        // Check for duplicate name
        const existingGroup = await taskGroupRepository.findOne({
          where: { name: updateData.name }
        });
        if (existingGroup && existingGroup.uuid !== groupId) {
          throw new Error(`Task group with name '${updateData.name}' already exists.`);
        }

        group.name = updateData.name;
      }

      if (updateData.description !== undefined) {
        group.description = updateData.description;
      }

      if (updateData.isActive !== undefined) {
        group.isActive = updateData.isActive;
      }

      await taskGroupRepository.save(group);

      logger.info(`Task group '${group.name}' updated.`);
      return group;
    } catch (error) {
      logger.error(`Failed to update task group ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a task group (tasks will have their groupId set to null due to onDelete: 'SET NULL')
   */
  static async deleteTaskGroup(groupId: string): Promise<void> {
    try {
      if (!ValidationUtil.isValidUuid(groupId)) {
        throw new Error("Invalid group UUID format.");
      }

      const taskGroupRepository = getTaskGroupRepository();
      const group = await taskGroupRepository.findOne({ where: { uuid: groupId } });

      if (!group) {
        throw new Error("Task group not found.");
      }

      await taskGroupRepository.remove(group);
      logger.info(`Task group '${group.name}' deleted.`);
    } catch (error) {
      logger.error(`Failed to delete task group ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Batch update task groups (active/inactive status)
   */
  static async batchUpdateTaskGroups(groupIds: string[], isActive: boolean): Promise<void> {
    try {
      const taskGroupRepository = getTaskGroupRepository();

      if (groupIds.length === 0) {
        // Update all groups and cascade to all tasks
        await taskGroupRepository.update({}, { isActive });

        // Cascade to all tasks
        const taskRepository = getTaskRepository();
        await taskRepository.update({}, { isActive });

        logger.info(`All task groups and tasks set to isActive: ${isActive}.`);
      } else {
        // Update specific groups and cascade to their tasks
        for (const groupId of groupIds) {
          if (!ValidationUtil.isValidUuid(groupId)) {
            logger.warn(`Skipping invalid group UUID during batch update: ${groupId}`);
            continue;
          }
          await taskGroupRepository.update({ uuid: groupId }, { isActive });
          await TaskGroupService.cascadeGroupActiveStatus(groupId, isActive);
        }
        logger.info(`Batch updated ${groupIds.length} task groups to isActive: ${isActive}.`);
      }
    } catch (error) {
      logger.error("Failed to batch update task groups:", error);
      throw error;
    }
  }

  /**
   * Batch delete task groups
   */
  static async batchDeleteTaskGroups(groupIds: string[]): Promise<void> {
    try {
      for (const groupId of groupIds) {
        if (!ValidationUtil.isValidUuid(groupId)) {
          logger.warn(`Skipping invalid group UUID during batch delete: ${groupId}`);
          continue;
        }
        await TaskGroupService.deleteTaskGroup(groupId);
      }
      logger.info(`Batch deleted ${groupIds.length} task groups.`);
    } catch (error) {
      logger.error("Failed to batch delete task groups:", error);
      throw error;
    }
  }

  private static async cascadeGroupActiveStatus(groupId: string, isActive: boolean): Promise<void> {
    try {
      const taskRepository = getTaskRepository();

      // Update all tasks in this group to match the group's active status
      await taskRepository
        .createQueryBuilder()
        .update(Task)
        .set({ isActive: isActive })
        .where('groupId = :groupId', { groupId })
        .execute();

      logger.info(`Cascaded group active status (${isActive}) to tasks in group ${groupId}`);
    } catch (error) {
      logger.error(`Failed to cascade group active status for group ${groupId}:`, error);
      throw error;
    }
  }
}

export default TaskGroupService;