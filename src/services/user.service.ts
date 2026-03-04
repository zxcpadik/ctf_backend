import { getUserRepository, getTeamRepository, getSessionRepository, getSubmissionRepository } from './database.service';
import logger from './logger.service';
import { User } from '../entities/User';
import ValidationUtil from '../utils/validation.util';
import MyError from '../utils/myerror.util';
import s from "http-status";

export type UserRelations = 'team' | 'sessions' | 'submissions';
export type UserRemoveStrategy = 'ignore' | 'reassign' | 'recursive';

/**
 * Service for managing users
 */
class UserService {

  static async get(user_uuid: string, relations: UserRelations[] = []): Promise<User | null> {
    try {
      if (!ValidationUtil.isValidUuid(user_uuid)) throw new MyError("Invalid user UUID", { code: s.BAD_REQUEST });

      const userRepository = getUserRepository();
      return await userRepository.findOne({
        where: { uuid: user_uuid },
        relations: relations
      });
    } catch (error) {
      logger.error("Failed to get user:", error);
      throw error;
    }
  }

  /**
   * Get all users with their team information
   */
  static async get_all(relations: UserRelations[] = []): Promise<User[]> {
    try {
      const userRepository = getUserRepository();
      return await userRepository.find({
        relations: relations,
        order: {
          is_admin: 'DESC',
          is_leader: 'DESC',
          created_at: 'DESC'
        }
      });
    } catch (error) {
      logger.error("Failed to get all users:", error);
      throw error;
    }
  }

  /**
   * Delete a user by UUID
   */
  static async delete(user_uuid: any | User, strategy: UserRemoveStrategy = 'ignore'): Promise<void> {
    try {
      if (typeof user_uuid === "string" && !ValidationUtil.isValidUuid(user_uuid)) throw new MyError("Invalid user reference", { code: s.BAD_REQUEST });

      const user_repo = getUserRepository();
      const team_repo = getTeamRepository();
      const session_repo = getSessionRepository();
      const submission_repo = getSubmissionRepository();

      const user = typeof user_uuid == "string" ? (await UserService.get(user_uuid, ["team"])) : user_uuid;
      if (!user) throw new MyError("User not found", { code: s.NOT_FOUND });

      // Prevent deleting the last admin user
      if (user.is_admin) {
        const admin_count = await user_repo.count({ where: { is_admin: true } });
        if (admin_count <= 1) throw new MyError("Cannot delete the last admin user", { code: s.CONFLICT });
      }

      // Handle team leader deletion
      if (user.is_leader && user.team && strategy !== "ignore") {
        const team_users = await user_repo.find({
          where: { team_uuid: user.team.uuid }
        });
        const teammates = team_users.filter(u => !u.is_leader && u.uuid !== user.uuid);

        if (strategy == "reassign") {
          if (teammates.length > 0) {
            const new_leader = teammates[0];
            new_leader.is_leader = true;
            await user_repo.save(new_leader);
            logger.info(`Promoted user ${new_leader.uuid} to team leader for team ${user.team.name}`);
          } else {
            await team_repo.remove(user.team);
            logger.info(`Deleted team ${user.team.name} as it had no remaining members`);
          }
        } else if (strategy == "recursive") {
          for (let teammate of teammates) {
            let ses_res = await session_repo.delete({ user_uuid: teammate.uuid });
            logger.info(`Deleted ${ses_res.affected || 0} sessions for user ${teammate.uuid}`);

            let sub_res = await submission_repo.delete({ user_uuid: teammate.uuid });
            logger.info(`Deleted ${sub_res.affected || 0} submissions for user ${teammate.uuid}`);

            await user_repo.remove(teammate);
            logger.info(`User ${teammate.uuid} (${teammate.name || 'no name'}) deleted successfully`);
          }
          await team_repo.remove(user.team);
          logger.info(`Deleted team ${user.team.name} as it had no remaining members`);
        }
      }

      let ses_res = await session_repo.delete({ user_uuid: user.uuid });
      if (!ses_res.affected) logger.info(`Deleted ${ses_res.affected} sessions for user ${user.uuid}`);

      let sub_res = await submission_repo.delete({ user_uuid: user.uuid });
      if (!sub_res.affected) logger.info(`Deleted ${sub_res.affected} submissions for user ${user.uuid}`);

      // Finally delete the user
      await user_repo.remove(user);
      logger.info(`User ${user.uuid} (${user.name || 'no name'}) deleted successfully`);
    } catch (error) {
      logger.error(`Failed to delete user ${typeof user_uuid == "string" ? user_uuid : user_uuid?.uuid}:`, error);
      throw error;
    }
  }

}

export { UserService };
export default UserService;