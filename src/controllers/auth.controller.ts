import { Request, Response } from 'express';
import AuthService from '../services/auth.service';
import logger from '../services/logger.service';
import { ResponseInterface, UserResponseData } from '../interfaces/response.interface';
import { getTeamRepository, getUserRepository } from '../services/database.service';
import EventEmitterService from '../services/event-emitter.service';
import s from "http-status";

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
      const result = await AuthService.user_auth(auth_code?.trim(), user_agent);

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

  // refactored in 1.0.1
  static async set_username(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.name) return (res.status(s.CONFLICT).json({ success: false, message: "Name already set" }), void 0);

      const { name: _name } = req.body;
      if (!_name || typeof _name !== 'string') return (res.status(s.BAD_REQUEST).json({ success: false, message: "Name can't be empty" }), void 0);
      const name = _name.trim();
      const username_length = name.length;
      if (username_length < 3) return (res.status(s.LENGTH_REQUIRED).json({ success: false, message: "Name must be at least 3 characters long" }), void 0);
      if (username_length > 16) return (res.status(s.REQUEST_ENTITY_TOO_LARGE).json({ success: false, message: "Name can't be longer than 16 characters" }), void 0);

      const user_repo = getUserRepository();
      req.user!.name = name;
      await user_repo.save(req.user!);

      if (!req.user!.isLeader && req.user!.teamId) {
        EventEmitterService.emitTeamMemberJoined(req.user!.teamId, req.user);
      }

      res.status(s.OK).json({
        success: true,
        message: "Name set successfully",
        data: { user: req.user }
      });
    } catch (error: any) {
      logger.error("Set username error:", error);
      res.status(s.INTERNAL_SERVER_ERROR).json({ success: false, message: error?.message || "Failed to set username" });
    }
  }

  // refactored in 1.0.1
  static async set_team_name(req: Request, res: Response): Promise<void> {
    try {
      if (req.user?.team) return (res.status(s.CONFLICT).json({ success: false, message: "Team already created" }), void 0);
      if (!req.user?.name) return (res.status(s.PRECONDITION_FAILED).json({ success: false, message: "Set your username first before setting team name" }), void 0);

      const { team_name: _team_name } = req.body;
      if (!_team_name || typeof _team_name !== 'string') return (res.status(s.BAD_REQUEST).json({ error: 'Team name can not be empty' }), void 0);
      const team_name = _team_name.trim();
      const team_name_len = team_name.length;

      if (team_name_len < 3) return (res.status(s.LENGTH_REQUIRED).json({ success: false, message: "Team name must be at least 3 characters long" }), void 0);
      if (team_name_len > 16) return (res.status(s.REQUEST_ENTITY_TOO_LARGE).json({ success: false, message: "Team name can't be longer than 16 characters" }), void 0);

      const team_repo = getTeamRepository();
      const is_team_exists = await team_repo.exists({ where: { name: team_name } });
      if (is_team_exists) return (res.status(s.CONFLICT).json({ success: false, message: "Team name already taken" }), void 0);

      const new_team = team_repo.create({ name: team_name });
      await team_repo.save(new_team);
      EventEmitterService.emitTeamCreated(new_team);

      const user_repo = getUserRepository();
      req.user.team = new_team;
      req.user.teamId = new_team.uuid;
      await user_repo.save(req.user);

      res.status(s.OK).json({
        success: true,
        message: "Team created and account finalized successfully",
        data: { user: req.user, team: new_team }
      });
    } catch (error: any) {
      logger.error("Set team name error:", error);
      res.status(s.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message || "Failed to set team name" });
    }
  }
}

export default AuthController;