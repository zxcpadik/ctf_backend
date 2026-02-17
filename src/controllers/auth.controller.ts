import { Request, Response } from 'express';
import AuthService from '../services/auth.service';
import logger from '../services/logger.service';
import { ResponseInterface, UserResponseData } from '../interfaces/response.interface';
import { getTeamRepository, getUserRepository } from '../services/database.service';
import EventEmitterService from '../services/event-emitter.service';

class AuthController {
  static async admin_auth(req: Request, res: Response): Promise<void> {
    try {
      const { password } = req.body;
      const user_agent = req.headers['user-agent'] || '';
      const result = await AuthService.admin_auth(password, user_agent);

      const response: ResponseInterface = {
        success: result.is_password_correct ?? false,
        message: result.message,
        data: { jwt: result.jwt, user: result.user }
      };

      res.status(result.is_password_correct === false ? 401 : 200).json(response);
    } catch (error: any) {
      logger.error("Admin auth error:", error);
      res.status(401).json({ success: false, message: error.message || "Authentication failed" });
    }
  }

  static async user_auth(req: Request, res: Response): Promise<void> {
    try {
      const { auth_code } = req.body;
      const user_agent = req.headers['user-agent'] || '';
      const result = await AuthService.user_auth(auth_code, user_agent);

      res.status(200).json({
        success: true,
        message: result.message,
        data: { jwt: result.jwt, user: result.user }
      });
    } catch (error: any) {
      logger.error("User auth error:", error);
      res.status(401).json({ success: false, message: error.message || "Authentication failed" });
    }
  }

  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const session_id = req.session?.uuid;
      if (!session_id) {
        res.status(400).json({ success: false, message: "No active session" });
        return;
      }

      await AuthService.logout(session_id);
      res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (error: any) {
      logger.error("Logout error:", error);
      res.status(500).json({ success: false, message: error.message || "Logout failed" });
    }
  }

  static async get_current_user(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Authentication required" });
        return;
      }

      let team = null;
      if (req.user.teamId) {
        const team_repo = getTeamRepository();
        team = await team_repo.findOneBy({ uuid: req.user.teamId });
      }

      const user_data: UserResponseData = {
        uuid: req.user.uuid,
        name: req.user.name,
        isLeader: req.user.isLeader,
        isAdmin: req.user.isAdmin,
        teamId: req.user.teamId,
        createdAt: req.user.createdAt,
        authCode: req.user.authCode,
        team
      };

      res.status(200).json({
        success: true,
        message: "User information retrieved successfully",
        data: user_data
      });
    } catch (error: any) {
      logger.error("Get current user error:", error);
      res.status(500).json({ success: false, message: error.message || "Failed to retrieve user information" });
    }
  }

  static async set_username(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Authentication required" });
        return;
      }

      if (req.user.name) {
        res.status(401).json({ success: false, message: "No-no-no mister fish, you can't change nickname :)" });
        return;
      }

      const { name } = req.body;
      if (!name || name.trim().length < 2) {
        res.status(400).json({ success: false, message: "Name must be at least 2 characters long" });
        return;
      }

      const user_repo = getUserRepository();
      req.user.name = name.trim();
      await user_repo.save(req.user);

      if (!req.user.isLeader && req.user.teamId) {
        EventEmitterService.emitTeamMemberJoined(req.user.teamId, req.user);
      }

      res.status(200).json({
        success: true,
        message: "Username set successfully",
        data: { user: req.user }
      });
    } catch (error: any) {
      logger.error("Set username error:", error);
      res.status(500).json({ success: false, message: error.message || "Failed to set username" });
    }
  }

  static async set_team_name(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(403).json({ success: false, message: "Only unfinalized team leaders can set team name" });
        return;
      }

      if (!req.user.name) {
        res.status(400).json({ success: false, message: "Please set your username first before setting team name" });
        return;
      }

      if (req.user.team) {
        res.status(400).json({ success: false, message: "Your team already created" });
        return;
      }

      const { team_name } = req.body;
      if (!team_name || team_name.trim().length < 2) {
        res.status(400).json({ success: false, message: "Team name must be at least 2 characters long" });
        return;
      }

      const team_repo = getTeamRepository();
      const existing_team = await team_repo.findOne({ where: { name: team_name.trim() } });
      if (existing_team) {
        res.status(400).json({ success: false, message: "Team name already taken" });
        return;
      }

      const new_team = team_repo.create({ name: team_name.trim() });
      await team_repo.save(new_team);
      EventEmitterService.emitTeamCreated(new_team);

      const user_repo = getUserRepository();
      req.user.team = new_team;
      req.user.teamId = new_team.uuid;
      await user_repo.save(req.user);

      res.status(200).json({
        success: true,
        message: "Team created and account finalized successfully",
        data: { user: req.user, team: new_team }
      });
    } catch (error: any) {
      logger.error("Set team name error:", error);
      res.status(500).json({ success: false, message: error.message || "Failed to set team name" });
    }
  }
}

export default AuthController;