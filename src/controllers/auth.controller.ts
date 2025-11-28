import { Request, Response } from 'express';
import AuthService from '../services/auth.service';
import logger from '../services/logger.service';
import { ResponseInterface, UserResponseData } from '../interfaces/response.interface';
import { getTeamRepository, getUserRepository } from '../services/database.service';
import { Team } from '../entities';

class AuthController {
  static async adminLogin(req: Request, res: Response): Promise<void> {
    try {
      const { password } = req.body;
      const userAgent = req.headers['user-agent'] || '';

      const result = await AuthService.adminAuth(password, userAgent);

      const response: ResponseInterface = {
        success: true,
        message: result.message,
        data: {
          jwt: result.jwt,
          user: result.user
        }
      };

      if (result.is_password_correct === false) res.status(401).json(response);
      else res.status(200).json(response);
    } catch (error: any) {
      logger.error("Admin auth error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Authentication failed"
      };

      res.status(401).json(response);
    }
  }

  static async userLogin(req: Request, res: Response): Promise<void> {
    try {
      const { authCode } = req.body;
      const userAgent = req.headers['user-agent'] || '';

      const result = await AuthService.userAuth(authCode, userAgent);

      const response: ResponseInterface = {
        success: true,
        message: result.message,
        data: {
          jwt: result.jwt,
          user: result.user
        }
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Complete user auth error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Authentication failed"
      };

      res.status(401).json(response);
    }
  }

  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.session?.uuid;

      if (!sessionId) {
        const response: ResponseInterface = {
          success: false,
          message: "No active session"
        };
        res.status(400).json(response);
        return;
      }

      await AuthService.logout(sessionId);

      const response: ResponseInterface = {
        success: true,
        message: "Logged out successfully"
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Logout error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Logout failed"
      };

      res.status(500).json(response);
    }
  }

  static async requestShareCode(req: Request, res: Response): Promise<void> {
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
        message: "Share code generated",
        data: { shareCode }
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Request share code error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to generate share code"
      };

      res.status(400).json(response);
    }
  }

  static async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ResponseInterface = {
          success: false,
          message: "Authentication required"
        };
        res.status(401).json(response);
        return;
      }


      let team: Team | null = null;
      if (req.user.teamId) {
        const teamRepo = getTeamRepository();
        team = await teamRepo.findOneBy({ uuid: req.user.teamId })
      }

      // Return user information (excluding sensitive data)
      const userData: UserResponseData = {
        uuid: req.user.uuid,
        name: req.user.name,
        isLeader: req.user.isLeader,
        isAdmin: req.user.isAdmin,
        teamId: req.user.teamId,
        createdAt: req.user.createdAt,
        authCode: req.user.authCode,
        team: team
      };

      const response: ResponseInterface = {
        success: true,
        message: "User information retrieved successfully",
        data: userData
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Get current user error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to retrieve user information"
      };

      res.status(500).json(response);
    }
  }


  static async setUsername(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ResponseInterface = {
          success: false,
          message: "Authentication required"
        };
        res.status(401).json(response);
        return;
      }

      if (req.user.name) {
        const response: ResponseInterface = {
          success: false,
          message: "No-no-no mister fish, you can't change nickname :)"
        };
        res.status(401).json(response);
        return;
      }

      const { name } = req.body;

      if (!name || name.trim().length < 2) {
        const response: ResponseInterface = {
          success: false,
          message: "Name must be at least 2 characters long"
        };
        res.status(400).json(response);
        return;
      }

      const userRepository = getUserRepository();
      req.user.name = name.trim();
      await userRepository.save(req.user);

      const response: ResponseInterface = {
        success: true,
        message: "Username set successfully",
        data: { user: req.user }
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Set username error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to set username"
      };

      res.status(500).json(response);
    }
  }

  static async setTeamName(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ResponseInterface = {
          success: false,
          message: "Only unfinalized team leaders can set team name"
        };
        res.status(403).json(response);
        return;
      }

      if (!req.user.name) {
        const response: ResponseInterface = {
          success: false,
          message: "Please set your username first before setting team name"
        };
        res.status(400).json(response);
        return;
      }

      if (req.user.team) {
        const response: ResponseInterface = {
          success: false,
          message: "Your team already created"
        };
        res.status(400).json(response);
        return;
      }

      const { teamName } = req.body;

      if (!teamName || teamName.trim().length < 2) {
        const response: ResponseInterface = {
          success: false,
          message: "Team name must be at least 2 characters long"
        };
        res.status(400).json(response);
        return;
      }

      // Check if team name is already taken
      const teamRepository = getTeamRepository();
      const existingTeam = await teamRepository.findOne({ where: { name: teamName.trim() } });
      if (existingTeam) {
        const response: ResponseInterface = {
          success: false,
          message: "Team name already taken"
        };
        res.status(400).json(response);
        return;
      }

      // Create the team
      const newTeam = teamRepository.create({
        name: teamName.trim()
      });
      await teamRepository.save(newTeam);

      // Update user with team and finalize account
      const userRepository = getUserRepository();
      req.user.team = newTeam;
      req.user.teamId = newTeam.uuid;
      await userRepository.save(req.user);

      const response: ResponseInterface = {
        success: true,
        message: "Team created and account finalized successfully",
        data: {
          user: req.user,
          team: newTeam
        }
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Set team name error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to set team name"
      };

      res.status(500).json(response);
    }
  }
}

export default AuthController;