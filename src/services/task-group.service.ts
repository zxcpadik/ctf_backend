import { getTaskGroupRepository } from './database.service';
import logger from './logger.service';
import { TaskGroup } from '../entities/TaskGroup';
import ValidationUtil from '../utils/validation.util';
import MyError from '../utils/myerror.util';
import s from "http-status";

export type TaskGroupRelations = "tasks";

class TaskGroupService {
  /**
   * Create a new task group
   */
  static async create(name: string, description?: string): Promise<TaskGroup> {
    try {
      const new_name = name?.trim();
      if (!ValidationUtil.isNonEmptyString(new_name)) throw new MyError("Group name cannot be empty", { code: s.UNPROCESSABLE_ENTITY });
      if (new_name.length > 254) throw new MyError("Task group name can't be longer than 254 characters", { code: s.REQUEST_ENTITY_TOO_LARGE });

      const task_group_repo = getTaskGroupRepository();

      // Check if group name already exists
      const is_name_taken = await task_group_repo.exists({ where: { name: new_name } });
      if (is_name_taken) throw new MyError(`Task group with name '${name}' already exists`, { code: s.CONFLICT });

      const new_group = task_group_repo.create({
        name,
        description: description || null,
      });

      await task_group_repo.save(new_group);
      logger.info(`Task group '${name}' created with UUID: ${new_group.uuid}`);
      return new_group;
    } catch (error) {
      logger.error("Failed to create task group:", error);
      throw error;
    }
  }

  /**
   * Get all task groups with their tasks
   */
  static async get_all(relations: TaskGroupRelations[] = []): Promise<TaskGroup[]> {
    try {
      const task_group_repo = getTaskGroupRepository();

      return await task_group_repo.find({
        relations,
        order: {
          name: 'ASC',
          created_at: 'DESC'
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
  static async get(group_uuid: any, relations: TaskGroupRelations[] = []): Promise<TaskGroup | null> {
    try {
      if (!ValidationUtil.isValidUuid(group_uuid)) throw new MyError("Invalid group UUID", { code: s.BAD_REQUEST });

      const task_group_repo = getTaskGroupRepository();
      return await task_group_repo.findOne({
        where: { uuid: group_uuid },
        relations
      });
    } catch (error) {
      logger.error(`Failed to get task group ${group_uuid}:`, error);
      throw error;
    }
  }

  /**
   * Update a task group
   */
  static async update(group_uuid: any | TaskGroup, update_data: { name?: string; description?: string; is_active?: boolean }): Promise<TaskGroup> {
    try {
      if (typeof group_uuid == "string" && !ValidationUtil.isValidUuid(group_uuid)) throw new MyError("Invalid group reference", { code: s.BAD_REQUEST });

      const group = typeof group_uuid == "string" ? (await TaskGroupService.get(group_uuid)) : group_uuid;
      if (!group) throw new MyError("Task group not found", { code: s.NOT_FOUND });
      const task_group_repo = getTaskGroupRepository();

      const new_name = update_data.name?.trim();
      if (new_name != undefined) {
        if (!ValidationUtil.isNonEmptyString(new_name)) throw new MyError("Group name cannot be empty", { code: s.UNPROCESSABLE_ENTITY });
        if (new_name.length > 254) throw new MyError("Task group name can't be longer than 254 characters", { code: s.REQUEST_ENTITY_TOO_LARGE });

        // Check for duplicate name
        const existing_group = await task_group_repo.findOne({
          where: { name: new_name }
        });
        if (existing_group && existing_group.uuid !== group.uuid) throw new MyError(`Task group with name '${new_name}' already exists`, { code: s.CONFLICT });

        group.name = new_name;
      }

      if (update_data.description !== undefined) group.description = update_data.description;
      if (update_data.is_active !== undefined) group.is_active = update_data.is_active;

      await task_group_repo.save(group);

      logger.info(`Task group '${group.name}' updated`);
      return group;
    } catch (error) {
      logger.error(`Failed to update task group ${typeof group_uuid == "string" ? group_uuid : group_uuid.uuid}:`, error);
      throw error;
    }
  }

  /**
   * Delete a task group
   */
  static async delete(group_uuid: any | TaskGroup): Promise<void> {
    try {
      if (typeof group_uuid == "string" && !ValidationUtil.isValidUuid(group_uuid)) throw new MyError("Invalid group UUID", { code: s.BAD_REQUEST });

      const group = typeof group_uuid == "string" ? (await TaskGroupService.get(group_uuid)) : group_uuid;
      if (!group) throw new MyError("Task group not found", { code: s.NOT_FOUND });

      await getTaskGroupRepository().remove(group);
      logger.info(`Task group '${group.name}' deleted.`);
    } catch (error) {
      logger.error(`Failed to delete task group ${typeof group_uuid == "string" ? group_uuid : group_uuid.uuid}:`, error);
      throw error;
    }
  }
}

export { TaskGroupService };
export default TaskGroupService;