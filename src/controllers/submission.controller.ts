import { Request, Response } from 'express';
import SubmissionService from '../services/submission.service';
import logger from '../services/logger.service';
import { ResponseInterface } from '../interfaces/response.interface';

class SubmissionController {
  static async submitFlag(req: Request, res: Response): Promise<void> {
    try {
      const { taskId, flag } = req.body;
      const user = req.user;
      const sessionId = req.session?.uuid;
      const ipAddress = req.ip || req.connection.remoteAddress || '';
      const userAgent = req.headers['user-agent'] || '';

      if (!user || !sessionId) {
        const response: ResponseInterface = {
          success: false,
          message: "Authentication required"
        };
        res.status(401).json(response);
        return;
      }

      const result = await SubmissionService.verifyFlag(
        taskId,
        flag,
        user,
        sessionId,
        ipAddress,
        userAgent
      );

      const response: ResponseInterface = {
        success: result.isCorrect,
        message: result.message,
        data: { isCorrect: result.isCorrect }
      };

      if (result.retryAfter) {
        response.data.retryAfter = result.retryAfter;
        res.status(429).json(response); // Too Many Requests
      } else {
        res.status(200).json(response);
      }
    } catch (error: any) {
      logger.error("Verify flag error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to verify flag"
      };

      res.status(400).json(response);
    }
  }

  static async getAllSubmissions(req: Request, res: Response): Promise<void> {
    try {
      const submissions = await SubmissionService.getAllSubmissions();

      const response: ResponseInterface = {
        success: true,
        message: "Submissions retrieved successfully",
        data: submissions
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Get all submissions error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to retrieve submissions"
      };

      res.status(500).json(response);
    }
  }

  /**
   * Get submissions by team (Admin only)
   */
  static async getSubmissionsByTeam(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;

      if (typeof teamId != 'string') {
        const response: ResponseInterface = {
          success: false,
          message: "Bad request"
        };
        res.status(400).json(response);
        return;
      }

      const submissions = await SubmissionService.getSubmissionsByTeam(teamId);

      const response: ResponseInterface = {
        success: true,
        message: "Team submissions retrieved successfully",
        data: submissions
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Get submissions by team error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to retrieve team submissions"
      };

      res.status(500).json(response);
    }
  }

  /**
   * Get current user's submissions
   */
  static async getMySubmissions(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user;
      
      if (!user) {
        const response: ResponseInterface = {
          success: false,
          message: "Authentication required"
        };
        res.status(401).json(response);
        return;
      }

      const submissions = await SubmissionService.getUserSubmissions(user.uuid);

      const response: ResponseInterface = {
        success: true,
        message: "User submissions retrieved successfully",
        data: submissions
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Get my submissions error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to retrieve user submissions"
      };

      res.status(500).json(response);
    }
  }
}

export default SubmissionController;