import { Request, Response } from 'express';
import LeaderboardService from '../services/leaderboard.service';
import logger from '../services/logger.service';
import { ResponseInterface } from '../interfaces/response.interface';

class LeaderboardController {
  static async getLeaderboard(req: Request, res: Response): Promise<void> {
    try {
      const { interval } = req.query;
      let intervals: number[] = [];

      if (interval) {
        // Parse the interval query parameter. It can be a single number or a comma-separated list.
        intervals = interval.toString().split(',').map(Number).filter(n => !isNaN(n));
      }

      // If no valid intervals provided, use a default set
      if (intervals.length === 0) {
        intervals = [60, 180, 300, 600, 3600];
      }

      const data = await LeaderboardService.getHistoricalData(intervals);

      const response: ResponseInterface = {
        success: true,
        message: "Leaderboard data retrieved successfully",
        data: {
          intervals: intervals.map(i => i.toString()),
          data
        }
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Get leaderboard error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to retrieve leaderboard"
      };

      res.status(500).json(response);
    }
  }
}

export default LeaderboardController;