import { Request, Response } from 'express';
import { getTeamRepository, getUserRepository, getSubmissionRepository } from '../services/database.service';
import logger from '../services/logger.service';
import { ResponseInterface } from '../interfaces/response.interface';
import AuthService from '../services/auth.service';
import TeamService from '../services/team.service';
import UserService from '../services/user.service';

class AdminController {
  static async deleteAllTeams(req: Request, res: Response): Promise<void> {
    try {
      const teamRepository = getTeamRepository();
      const userRepository = getUserRepository();
      const submissionRepository = getSubmissionRepository();

      // Remove all submissions
      await submissionRepository.clear();

      // Remove all users (except admins) and their associations
      await userRepository
        .createQueryBuilder()
        .delete()
        .where("isAdmin = :isAdmin", { isAdmin: false })
        .execute();

      // Remove all teams
      await teamRepository.clear();

      const response: ResponseInterface = {
        success: true,
        message: "All teams, non-admin users, and submissions removed successfully"
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Remove all teams error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to remove all teams"
      };

      res.status(500).json(response);
    }
  }

  static async getAdminStats(req: Request, res: Response): Promise<void> {
    try {
      const userRepository = getUserRepository();
      const teamRepository = getTeamRepository();
      const submissionRepository = getSubmissionRepository();

      const totalUsers = await userRepository.count({ where: { isAdmin: false } });
      const totalTeams = await teamRepository.count();
      const totalSubmissions = await submissionRepository.count();
      const correctSubmissions = await submissionRepository.count({ where: { isCorrect: true } });

      const response: ResponseInterface = {
        success: true,
        message: "Admin stats retrieved successfully",
        data: {
          totalUsers,
          totalTeams,
          totalSubmissions,
          correctSubmissions
        }
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Get admin stats error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to retrieve admin stats"
      };

      res.status(500).json(response);
    }
  }

  static async generateTeamLeaderCode(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.generateTeamLeaderAuthCode();

      const response: ResponseInterface = {
        success: true,
        message: "Team leader auth code generated",
        data: result
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Generate team leader code error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to generate team leader code"
      };

      res.status(500).json(response);
    }
  }

  static async getAllTeams(req: Request, res: Response): Promise<void> {
    try {
      if (!req.isAdmin) {
        const response: ResponseInterface = {
          success: false,
          message: "Admin privileges required"
        };
        res.status(403).json(response);
        return;
      }

      const teams = await TeamService.getAllTeams();

      const response: ResponseInterface = {
        success: true,
        message: "Teams with relations retrieved successfully",
        data: teams
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Get all teams with relations error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to retrieve teams"
      };

      res.status(500).json(response);
    }
  }

  static async getTeamById(req: Request, res: Response): Promise<void> {
    try {
      if (!req.isAdmin) {
        const response: ResponseInterface = {
          success: false,
          message: "Admin privileges required"
        };
        res.status(403).json(response);
        return;
      }

      const { teamId } = req.params;

      if (typeof teamId != 'string') {
        const response: ResponseInterface = {
          success: false,
          message: "Bad request"
        };
        res.status(400).json(response);
        return;
      }

      const team = await TeamService.getTeam(teamId);

      if (!team) {
        const response: ResponseInterface = {
          success: false,
          message: "Team not found"
        };
        res.status(404).json(response);
        return;
      }

      const response: ResponseInterface = {
        success: true,
        message: "Team with relations retrieved successfully",
        data: team
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Get team with relations error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to retrieve team"
      };

      res.status(500).json(response);
    }
  }

  static async getTeamStatistics(req: Request, res: Response): Promise<void> {
    try {
      if (!req.isAdmin) {
        const response: ResponseInterface = {
          success: false,
          message: "Admin privileges required"
        };
        res.status(403).json(response);
        return;
      }

      const { teamId } = req.params;

      if (typeof teamId != 'string') {
        const response: ResponseInterface = {
          success: false,
          message: "Bad request"
        };
        res.status(400).json(response);
        return;
      }

      const statistics = await TeamService.getTeamStatistics(teamId);

      const response: ResponseInterface = {
        success: true,
        message: "Team statistics retrieved successfully",
        data: statistics
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Get team statistics error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to retrieve team statistics"
      };

      res.status(500).json(response);
    }
  }

  /**
   * Get all users (Admin only)
   */
  static async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      if (!req.isAdmin) {
        const response: ResponseInterface = {
          success: false,
          message: "Admin privileges required"
        };
        res.status(403).json(response);
        return;
      }

      const users = await UserService.getAllUsers();

      const response: ResponseInterface = {
        success: true,
        message: "Users retrieved successfully",
        data: users
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Get all users error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to retrieve users"
      };

      res.status(500).json(response);
    }
  }

  /**
   * Delete a user (Admin only)
   */
  static async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      if (!req.isAdmin) {
        const response: ResponseInterface = {
          success: false,
          message: "Admin privileges required"
        };
        res.status(403).json(response);
        return;
      }

      const { userId } = req.params;

      if (typeof userId != 'string') {
        const response: ResponseInterface = {
          success: false,
          message: "Bad request"
        };
        res.status(400).json(response);
        return;
      }

      await UserService.deleteUser(userId);

      const response: ResponseInterface = {
        success: true,
        message: "User deleted successfully"
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Delete user error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to delete user"
      };

      res.status(400).json(response);
    }
  }

  /**
   * Get user statistics (Admin only)
   */
  static async getUserStatistics(req: Request, res: Response): Promise<void> {
    try {
      if (!req.isAdmin) {
        const response: ResponseInterface = {
          success: false,
          message: "Admin privileges required"
        };
        res.status(403).json(response);
        return;
      }

      const statistics = await UserService.getUserStatistics();

      const response: ResponseInterface = {
        success: true,
        message: "User statistics retrieved successfully",
        data: statistics
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Get user statistics error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to retrieve user statistics"
      };

      res.status(500).json(response);
    }
  }
}

export default AdminController;