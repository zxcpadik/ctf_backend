import { getTeamRepository, getLeaderboardSnapshotRepository } from './database.service';
import logger from './logger.service';
import { LeaderboardSnapshot } from '../entities/LeaderboardSnapshot';
import { LessThanOrEqual } from 'typeorm'; // Import the TypeORM operator
import Environment from '../config/environment';

interface TeamScoreData {
  name: string;
  score: number;
  solvedTasks: number;
  solvedTasksUuid: string[];
  userCount: number;
  team_id: string;
}

interface LeaderboardData {
  teams: TeamScoreData[];
}

class LeaderboardService {
  /**
   * Calculates current leaderboard data.
   */
  static async calculateCurrentLeaderboard(): Promise<LeaderboardData> {
    try {
      const teamRepository = getTeamRepository();
      const teams = await teamRepository.find({
        relations: ['users', 'submissions']
      });

      const teamData: TeamScoreData[] = await Promise.all(
        teams.map(async (team) => {
          const correctSubmissions = team.submissions.filter(s => s.isCorrect);
          const uniqueSolvedTasks = [...new Set(correctSubmissions.map(s => s.taskId))];
          
          return {
            name: team.name,
            score: team.score,
            solvedTasks: uniqueSolvedTasks.length,
            solvedTasksUuid: uniqueSolvedTasks,
            userCount: team.users.length,
            team_id: team.uuid
          };
        })
      );

      // Sort by score descending
      teamData.sort((a, b) => b.score - a.score);

      return { teams: teamData };
    } catch (error) {
      logger.error("Failed to calculate leaderboard:", error);
      throw error;
    }
  }

  /**
   * Takes a snapshot of the current leaderboard and stores it.
   */
  static async takeSnapshot(): Promise<void> {
    try {
      const data = await this.calculateCurrentLeaderboard();
      const snapshotRepository = getLeaderboardSnapshotRepository();
      
      const snapshot = snapshotRepository.create({
        timestamp: new Date(),
        data: JSON.stringify(data)
      });

      await snapshotRepository.save(snapshot);
      logger.debug("Leaderboard snapshot taken.");
    } catch (error) {
      logger.error("Failed to take leaderboard snapshot:", error);
    }
  }

  /**
   * Gets historical leaderboard data for specified intervals.
   */
  static async getHistoricalData(intervals: number[]): Promise<{ [key: string]: LeaderboardData }> {
    try {
      const snapshotRepository = getLeaderboardSnapshotRepository();
      const now = new Date();
      const result: { [key: string]: LeaderboardData } = {};

      for (const interval of intervals) {
        const targetTime = new Date(now.getTime() - interval * 1000);
        
        const snapshot = await snapshotRepository.findOne({
          where: { timestamp: LessThanOrEqual(targetTime) },
          order: { timestamp: 'DESC' }
        });

        if (snapshot) {
          result[interval.toString()] = JSON.parse(snapshot.data);
        }
      }

      return result;
    } catch (error) {
      logger.error("Failed to get historical leaderboard data:", error);
      throw error;
    }
  }
}

export default LeaderboardService;