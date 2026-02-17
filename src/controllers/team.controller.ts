import { Request, Response } from 'express';
import UserService from '../services/user.service';
import AuthService from '../services/auth.service';
import TeamService from '../services/team.service';
import TaskService from '../services/task.service';
import logger from '../services/logger.service';
import { ResponseInterface } from '../interfaces/response.interface';

class TeamController {
  /**
   * Get current user's team
   */
  static async getMyTeam(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.teamId) {
        const response: ResponseInterface = {
          success: false,
          message: "User is not part of a team"
        };
        res.status(404).json(response);
        return;
      }

      const team = await TeamService.getTeamExById(req.user.teamId);

      const response: ResponseInterface = {
        success: true,
        message: "Team retrieved successfully",
        data: team
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Get team error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to retrieve team"
      };

      res.status(500).json(response);
    }
  }

  /**
   * Get current user's team score
   */
  static async getMyTeamScore(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.teamId) {
        const response: ResponseInterface = {
          success: false,
          message: "User is not part of a team"
        };
        res.status(404).json(response);
        return;
      }

      const score = await TeamService.getTeamScoreById(req.user.teamId);

      const response: ResponseInterface = {
        success: true,
        message: "Team score retrieved successfully",
        data: { score }
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Get team score error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to retrieve team score"
      };

      res.status(500).json(response);
    }
  }

  /**
   * Get current user's team solves
   */
  static async getMyTeamSolves(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.teamId) {
        const response: ResponseInterface = {
          success: false,
          message: "User is not part of a team"
        };
        res.status(404).json(response);
        return;
      }

      const solvedTasks = await TaskService.getSolvedTasks(req.user.teamId);

      const response: ResponseInterface = {
        success: true,
        message: "Team solves retrieved successfully",
        data: solvedTasks
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Get team solves error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to retrieve team solves"
      };

      res.status(500).json(response);
    }
  }

  /**
   * Get current user's team statistics
   */
  static async getMyTeamStatistics(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.teamId) {
        const response: ResponseInterface = {
          success: false,
          message: "User is not part of a team"
        };
        res.status(404).json(response);
        return;
      }

      const statistics = await TeamService.getTeamStatistics(req.user.teamId);

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
   * Get team members
   */
  static async getTeamMembers(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.teamId) {
        const response: ResponseInterface = {
          success: false,
          message: "User is not part of a team"
        };
        res.status(404).json(response);
        return;
      }

      const members = await TeamService.getTeamMembers(req.user.teamId);

      const response: ResponseInterface = {
        success: true,
        message: "Team members retrieved successfully",
        data: members
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Get team members error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to retrieve team members"
      };

      res.status(500).json(response);
    }
  }

  /**
   * Remove team member (Leader only)
   */
  static async removeMember(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!req.user?.teamId) {
        const response: ResponseInterface = {
          success: false,
          message: "User is not part of a team"
        };
        res.status(404).json(response);
        return;
      }

      if (typeof userId != 'string') {
        const response: ResponseInterface = {
          success: false,
          message: "Bad request"
        };
        res.status(400).json(response);
        return;
      }

      await TeamService.removeMember(req.user.teamId, userId);

      const response: ResponseInterface = {
        success: true,
        message: "Team member removed successfully"
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Remove team member error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to remove team member"
      };

      res.status(400).json(response);
    }
  }

  /**
   * Generate member invitation code (Leader only)
   */
  static async generateMemberCode(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ResponseInterface = {
          success: false,
          message: "Authentication required"
        };
        res.status(401).json(response);
        return;
      }

      const shareCode = await AuthService.requestShareCode(req.user);

      const response: ResponseInterface = {
        success: true,
        message: "Member invitation code generated successfully",
        data: { shareCode }
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Generate member code error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to generate member code"
      };

      res.status(400).json(response);
    }
  }

  /**
   * Update team name (Leader only)
   */
  static async updateTeamName(req: Request, res: Response): Promise<void> {
    try {
      const { teamName } = req.body;

      if (!req.user?.teamId) {
        const response: ResponseInterface = {
          success: false,
          message: "User is not part of a team"
        };
        res.status(404).json(response);
        return;
      }

      if (!teamName || teamName.trim().length < 2) {
        const response: ResponseInterface = {
          success: false,
          message: "Team name must be at least 2 characters long"
        };
        res.status(400).json(response);
        return;
      }

      const updatedTeam = await TeamService.updateTeamName(req.user.teamId, teamName.trim());

      const response: ResponseInterface = {
        success: true,
        message: "Team name updated successfully",
        data: updatedTeam
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Update team name error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to update team name"
      };

      res.status(400).json(response);
    }
  }

  /**
   * Get teammates (for leader)
   */
  static async getTeammates(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.isLeader || !req.user.teamId) {
        const response: ResponseInterface = {
          success: false,
          message: "Team leader privileges required"
        };
        res.status(403).json(response);
        return;
      }

      const teammates = await UserService.getTeammates(req.user.teamId);

      const response: ResponseInterface = {
        success: true,
        message: "Teammates retrieved successfully",
        data: teammates
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Get teammates error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to retrieve teammates"
      };

      res.status(500).json(response);
    }
  }

  /**
   * Generate share code (for leader)
   */
  static async generateShareCode(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.isLeader || !req.user.name) {
        const response: ResponseInterface = {
          success: false,
          message: "Only finalized team leaders can generate share codes"
        };
        res.status(403).json(response);
        return;
      }

      const shareCode = await AuthService.requestShareCode(req.user);

      const response: ResponseInterface = {
        success: true,
        message: "Share code generated successfully",
        data: { shareCode }
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Generate share code error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to generate share code"
      };

      res.status(400).json(response);
    }
  }
}

export default TeamController;