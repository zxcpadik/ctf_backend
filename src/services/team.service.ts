import { getTeamRepository, getUserRepository, getSubmissionRepository } from './database.service';
import logger from './logger.service';
import { Team } from '../entities/Team';
import { User } from '../entities/User';
import ValidationUtil from '../utils/validation.util';
import UserService from './user.service';
import TaskService from './task.service';
import EventEmitterService from './event-emitter.service';

interface TeamWithRelations extends Team {
  leader?: User;
  teammates: User[];
  totalSubmissions: number;
  correctSubmissions: number;
}

export type TeamRelations = 'submissions' | 'users';

class TeamService {
  /**
   * Get all teams with their relations (leader, teammates, submission stats)
   */
  static async getAllTeams(): Promise<TeamWithRelations[]> {
    try {
      const teamRepository = getTeamRepository();
      const userRepository = getUserRepository();
      const submissionRepository = getSubmissionRepository();

      // Get all teams
      const teams = await teamRepository.find({
        order: { score: 'DESC', createdAt: 'ASC' }
      });

      const teamsWithRelations: TeamWithRelations[] = [];

      for (const team of teams) {
        // Get all users in this team
        const users = await userRepository.find({
          where: { teamId: team.uuid },
          order: { isLeader: 'DESC', createdAt: 'ASC' }
        });

        // Find the team leader
        const leader = users.find(user => user.isLeader);
        
        // Get teammates (non-leaders)
        const teammates = users.filter(user => !user.isLeader);

        // Get submission statistics
        const submissions = await submissionRepository.find({
          where: { teamId: team.uuid }
        });

        const correctSubmissions = submissions.filter(s => s.isCorrect).length;

        teamsWithRelations.push({
          ...team,
          leader,
          teammates,
          totalSubmissions: submissions.length,
          correctSubmissions
        } as any);
      }

      return teamsWithRelations;
    } catch (error) {
      logger.error("Failed to get teams with relations:", error);
      throw error;
    }
  }

  /**
   * Get a specific team
   */
  static async getTeamById(teamId: string, relations: TeamRelations[] = []): Promise<Team | null> {
    try {
      const teamRepository = getTeamRepository();

      return await teamRepository.findOne({ 
        where: { uuid: teamId }, 
        relations: relations 
      });
    } catch (error) {
      logger.error(`Failed to get team ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific team with all relations
   */
  static async getTeamExById(teamId: string): Promise<TeamWithRelations | null> {
    try {
      if (!ValidationUtil.isValidUuid(teamId)) {
        throw new Error("Invalid team UUID format.");
      }

      const teamRepository = getTeamRepository();
      const userRepository = getUserRepository();
      const submissionRepository = getSubmissionRepository();

      const team = await teamRepository.findOne({
        where: { uuid: teamId }
      });

      if (!team) {
        return null;
      }

      // Get all users in this team
      const users = await userRepository.find({
        where: { teamId: team.uuid },
        order: { isLeader: 'DESC', createdAt: 'ASC' }
      });

      // Find the team leader
      const leader = users.find(user => user.isLeader);
      
      // Get teammates (non-leaders)
      const teammates = users.filter(user => !user.isLeader);

      // Get submission statistics
      const submissions = await submissionRepository.find({
        where: { teamId: team.uuid },
        relations: ['task']
      });

      const correctSubmissions = submissions.filter(s => s.isCorrect).length;

      return {
        ...team,
        leader,
        teammates,
        totalSubmissions: submissions.length,
        correctSubmissions,
        submissions
      } as any;
    } catch (error) {
      logger.error(`Failed to get team ${teamId} with relations:`, error);
      throw error;
    }
  }

  /**
   * Get team by ID (alias for getTeamExById)
   */
  static async getTeam(teamId: string): Promise<TeamWithRelations | null> {
    return this.getTeamExById(teamId);
  }

  /**
   * Get detailed team statistics
   */
  static async getTeamStatistics(teamId: string): Promise<{
    totalMembers: number;
    totalSubmissions: number;
    correctSubmissions: number;
    accuracy: number;
    solvedTasks: string[];
    submissionTimeline: { date: string; count: number }[];
  }> {
    try {
      if (!ValidationUtil.isValidUuid(teamId)) {
        throw new Error("Invalid team UUID format.");
      }

      const userRepository = getUserRepository();
      const submissionRepository = getSubmissionRepository();

      // Count team members
      const members = await userRepository.find({ where: { teamId } });
      const totalMembers = members.length;

      // Get submissions
      const submissions = await submissionRepository.find({
        where: { teamId },
        relations: ['task']
      });

      const correctSubmissions = submissions.filter(s => s.isCorrect);
      const solvedTasks = [...new Set(correctSubmissions.map(s => s.taskId))];

      // Calculate accuracy
      const accuracy = submissions.length > 0 
        ? (correctSubmissions.length / submissions.length) * 100 
        : 0;

      // Create submission timeline (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const timelineData = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const daySubmissions = submissions.filter(s => {
          const subDate = new Date(s.timestamp).toISOString().split('T')[0];
          return subDate === dateStr;
        });

        timelineData.push({
          date: dateStr,
          count: daySubmissions.length
        });
      }

      timelineData.reverse();

      return {
        totalMembers,
        totalSubmissions: submissions.length,
        correctSubmissions: correctSubmissions.length,
        accuracy: Math.round(accuracy * 100) / 100,
        solvedTasks,
        submissionTimeline: timelineData
      };
    } catch (error) {
      logger.error(`Failed to get team statistics for ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Get user's team
   */
  static async getUserTeamById(userId: string): Promise<Team | null> {
    try {
      const user = await UserService.getUserById(userId);
      if (!user?.teamId) return null;
      return TeamService.getTeamById(user.teamId, ['submissions']);
    } catch (error) {
      logger.error("Failed to get user team:", error);
      throw error;
    }
  }

  /**
   * Get team score
   */
  static async getTeamScoreById(teamId: string): Promise<number | null> {
    try {
      const team = await TeamService.getTeamById(teamId, ['submissions']);
      if (!team) return null;

      // Calculate score from correct submissions
      const correctSubmissions = team.submissions.filter(sub => sub.isCorrect);
      
      // We need to get task scores for each submission
      let totalScore = 0;
      for (const submission of correctSubmissions) {
        const task = await TaskService.getTaskById(submission.taskId);
        if (task) {
          totalScore += task.score;
        }
      }

      return totalScore;
    } catch (error) {
      logger.error("Failed to get team score:", error);
      throw error;
    }
  }

  /**
   * Get team members
   */
  static async getTeamMembers(teamId: string): Promise<User[]> {
    try {
      const userRepository = getUserRepository();
      return await userRepository.find({
        where: { teamId },
        select: ['uuid', 'name', 'isLeader', 'createdAt', 'authCode'],
        order: { isLeader: 'DESC', createdAt: 'ASC' }
      });
    } catch (error) {
      logger.error(`Failed to get team members for ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Remove member from team
   */
  static async removeMember(teamId: string, userId: string): Promise<void> {
    try {
      const userRepository = getUserRepository();
      const user = await userRepository.findOne({
        where: { uuid: userId, teamId }
      });
      
      if (!user) {
        throw new Error("User not found in team");
      }
      
      if (user.isLeader) {
        throw new Error("Cannot remove team leader");
      }
      
      // Remove user from team
      user.teamId = null;
      user.team = null;
      await userRepository.save(user);

      logger.info(`User ${userId} removed from team ${teamId}`);
      EventEmitterService.emitTeamMemberLeft(teamId, user);
    } catch (error) {
      logger.error(`Failed to remove member ${userId} from team ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Update team name
   */
  static async updateTeamName(teamId: string, teamName: string): Promise<Team> {
    try {
      if (!ValidationUtil.isValidUuid(teamId)) {
        throw new Error("Invalid team UUID format.");
      }

      if (!ValidationUtil.isNonEmptyString(teamName) || teamName.trim().length < 2) {
        throw new Error("Team name must be at least 2 characters long.");
      }

      const teamRepository = getTeamRepository();
      
      // Check if team name is already taken
      const existingTeam = await teamRepository.findOne({ 
        where: { name: teamName.trim() } 
      });
      
      if (existingTeam && existingTeam.uuid !== teamId) {
        throw new Error("Team name already taken");
      }

      const team = await teamRepository.findOne({ where: { uuid: teamId } });
      if (!team) {
        throw new Error("Team not found");
      }

      team.name = teamName.trim();
      await teamRepository.save(team);

      logger.info(`Team ${teamId} name updated to: ${teamName}`);
      EventEmitterService.emitTeamUpdated(team);
      return team;
    } catch (error) {
      logger.error(`Failed to update team name for ${teamId}:`, error);
      throw error;
    }
  }
}

export default TeamService;
export type { TeamWithRelations };