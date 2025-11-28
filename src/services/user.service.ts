import { getUserRepository, getTeamRepository, getSessionRepository, getSubmissionRepository } from './database.service';
import logger from './logger.service';
import { User } from '../entities/User';
import ValidationUtil from '../utils/validation.util';
import { IsNull, Not } from 'typeorm';

export type UserRelations = 'team' | 'sessions' | 'submissions';

/**
 * Service for managing user-related operations, particularly account finalization and team assignment.
 */
class UserService {

  static async getUserById(userId: string, relations: UserRelations[] = []): Promise<User | null> {
    try {
      const userRepository = getUserRepository();
      return await userRepository.findOne({
        where: { uuid: userId },
        relations: relations
      });
    } catch (error) {
      logger.error("Failed to get user:", error);
      throw error;
    }
  }

  static async getTeammates(teamId: string): Promise<User[]> {
    try {
      const userRepository = getUserRepository();
      return await userRepository.find({
        where: { teamId: teamId, isLeader: false }, // Exclude the leader
        select: ['uuid', 'createdAt', 'isLeader'] // Only return necessary fields
      });
    } catch (error) {
      logger.error("Failed to get teammates:", error);
      throw error;
    }
  }

  /**
   * Get all users with their team information (Admin only)
   */
  static async getAllUsers(): Promise<User[]> {
    try {
      const userRepository = getUserRepository();

      return await userRepository.find({
        relations: ['team'],
        order: {
          isAdmin: 'DESC',
          isLeader: 'DESC',
          createdAt: 'DESC'
        }
      });
    } catch (error) {
      logger.error("Failed to get all users:", error);
      throw error;
    }
  }

  /**
   * Delete a user by UUID (Admin only)
   * Note: If the user is a team leader, we need to handle team reassignment or deletion
   */
  static async deleteUser(userId: string): Promise<void> {
    try {
      if (!ValidationUtil.isValidUuid(userId)) {
        throw new Error("Invalid user UUID format.");
      }

      const userRepository = getUserRepository();
      const teamRepository = getTeamRepository();
      const sessionRepository = getSessionRepository();
      const submissionRepository = getSubmissionRepository();

      const user = await userRepository.findOne({
        where: { uuid: userId },
        relations: ['team', 'sessions', 'submissions']
      });

      if (!user) {
        throw new Error("User not found.");
      }

      // Prevent deleting the last admin user
      if (user.isAdmin) {
        const adminCount = await userRepository.count({ where: { isAdmin: true } });
        if (adminCount <= 1) {
          throw new Error("Cannot delete the last admin user.");
        }
      }

      // Handle team leader deletion
      if (user.isLeader && user.team) {
        const teamUsers = await userRepository.find({
          where: { teamId: user.team.uuid }
        });

        const otherLeaders = teamUsers.filter(u => u.isLeader && u.uuid !== userId);

        if (otherLeaders.length === 0) {
          // No other leaders in the team, promote the first teammate or delete team
          const teammates = teamUsers.filter(u => !u.isLeader && u.uuid !== userId);

          if (teammates.length > 0) {
            // Promote the first teammate to leader
            const newLeader = teammates[0];
            newLeader.isLeader = true;
            await userRepository.save(newLeader);
            logger.info(`Promoted user ${newLeader.uuid} to team leader for team ${user.team.name}`);
          } else {
            // No other users in team, delete the team
            await teamRepository.remove(user.team);
            logger.info(`Deleted team ${user.team.name} as it had no remaining members`);
          }
        }
      }

      // Delete user's sessions
      if (user.sessions && user.sessions.length > 0) {
        await sessionRepository.remove(user.sessions);
        logger.info(`Deleted ${user.sessions.length} sessions for user ${userId}`);
      }

      // Delete user's submissions
      if (user.submissions && user.submissions.length > 0) {
        await submissionRepository.remove(user.submissions);
        logger.info(`Deleted ${user.submissions.length} submissions for user ${userId}`);
      }

      // Finally delete the user
      await userRepository.remove(user);
      logger.info(`User ${userId} (${user.name || 'no name'}) deleted successfully`);
    } catch (error) {
      logger.error(`Failed to delete user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get user statistics (Admin only)
   */
  static async getUserStatistics(): Promise<{
    totalUsers: number;
    totalAdmins: number;
    totalLeaders: number;
    totalTeammates: number;
    finalizedAccounts: number;
    pendingAccounts: number;
    usersByTeam: { teamName: string; count: number }[];
  }> {
    try {
      const userRepository = getUserRepository();
      const teamRepository = getTeamRepository();

      const totalUsers = await userRepository.count();
      const totalAdmins = await userRepository.count({ where: { isAdmin: true } });
      const totalLeaders = await userRepository.count({ where: { isLeader: true, isAdmin: false } });
      const totalTeammates = await userRepository.count({ where: { isLeader: false, isAdmin: false } });
      const finalizedAccounts = await userRepository.count({ where: { name: IsNull() } });
      const pendingAccounts = await userRepository.count({ where: { name: Not(IsNull()) } });

      // Get users by team
      const teams = await teamRepository.find({ relations: ['users'] });
      const usersByTeam = teams.map(team => ({
        teamName: team.name,
        count: team.users.length
      }));

      // Add ungrouped users
      const ungroupedUsers = await userRepository.count({ where: { teamId: IsNull() } });
      if (ungroupedUsers > 0) {
        usersByTeam.push({
          teamName: 'No Team',
          count: ungroupedUsers
        });
      }

      return {
        totalUsers,
        totalAdmins,
        totalLeaders,
        totalTeammates,
        finalizedAccounts,
        pendingAccounts,
        usersByTeam
      };
    } catch (error) {
      logger.error("Failed to get user statistics:", error);
      throw error;
    }
  }
}

export default UserService;