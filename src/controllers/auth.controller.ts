import { Request, Response } from 'express';
import AuthService from '../services/auth.service';
import { getUserRepository, getTeamRepository } from '../services/database.service';
import logger from '../services/logger.service';
import MyError from '../utils/myerror.util';
import s from "http-status";

class AuthController {
  /**
   * POST /auth/login
   * Unified login — auth code (8 digits) or name + password (+ optional TOTP token).
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { identifier, password, totp_token } = req.body;
      const user_agent = req.headers['user-agent'] || '';

      const result = await AuthService.login(identifier, user_agent, password, totp_token);

      if (result.totp_required) {
        res.status(s.OK).json({ success: false, totp_required: true, message: result.message });
        return;
      }

      res.status(s.OK).json({ success: true, message: result.message, data: { jwt: result.jwt, user: result.user } });
    } catch (error: any) {
      logger.error("Login error:", error);
      res.status(error instanceof MyError ? (error.code || 500) : s.UNAUTHORIZED).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /auth/logout
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      await AuthService.logout(req.session!.uuid);
      res.status(s.OK).json({ success: true, message: "Logged out successfully" });
    } catch (error: any) {
      logger.error("Logout error:", error);
      res.status(error instanceof MyError ? (error.code || 500) : s.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /auth/me
   * Returns the current user and their team.
   */
  static async me(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      let team = null;
      if (user.team_uuid) {
        team = await getTeamRepository().findOneBy({ uuid: user.team_uuid });
      }

      res.status(s.OK).json({
        success: true,
        data: {
          uuid:        user.uuid,
          name:        user.name,
          is_leader:   user.is_leader,
          is_admin:    user.is_admin,
          team_uuid:   user.team_uuid,
          totp_enabled: user.totp_enabled,
          setup_stage: req.setup_stage,
          created_at:  user.created_at,
          team,
        },
      });
    } catch (error: any) {
      logger.error("Get current user error:", error);
      res.status(s.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
    }
  }

  // ─── Setup endpoints ─────────────────────────────────────────────────────────
  // Each is only reachable at the correct stage via ensure_stage() middleware.

  /**
   * PATCH /auth/setup/password
   * Stage: 'password' — set the initial password.
   */
  static async setup_password(req: Request, res: Response): Promise<void> {
    try {
      const { password } = req.body;
      await AuthService.set_password(req.user!, password);
      res.status(s.OK).json({ success: true, message: "Password set successfully" });
    } catch (error: any) {
      logger.error("Setup password error:", error);
      res.status(error instanceof MyError ? (error.code || 500) : s.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }

  /**
   * PATCH /auth/setup/profile
   * Stage: 'profile' — set display name.
   */
  static async setup_profile(req: Request, res: Response): Promise<void> {
    try {
      const name = req.body.name?.trim();
      if (!name || typeof name !== 'string') {
        res.status(s.BAD_REQUEST).json({ success: false, message: "Name cannot be empty" });
        return;
      }
      if (name.length < 3)  { res.status(s.LENGTH_REQUIRED).json({ success: false, message: "Name must be at least 3 characters" }); return; }
      if (name.length > 16) { res.status(s.REQUEST_ENTITY_TOO_LARGE).json({ success: false, message: "Name cannot exceed 16 characters" }); return; }

      const user_repo = getUserRepository();
      req.user!.name = name;
      await user_repo.save(req.user!);

      res.status(s.OK).json({ success: true, message: "Profile set successfully", data: { user: req.user } });
    } catch (error: any) {
      logger.error("Setup profile error:", error);
      res.status(s.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
    }
  }

  /**
   * PATCH /auth/setup/team
   * Stage: 'team', leaders only — create team and finalise account.
   */
  static async setup_team(req: Request, res: Response): Promise<void> {
    try {
      const team_name = req.body.team_name?.trim();
      if (!team_name || typeof team_name !== 'string') {
        res.status(s.BAD_REQUEST).json({ success: false, message: "Team name cannot be empty" });
        return;
      }
      if (team_name.length < 3)  { res.status(s.LENGTH_REQUIRED).json({ success: false, message: "Team name must be at least 3 characters" }); return; }
      if (team_name.length > 16) { res.status(s.REQUEST_ENTITY_TOO_LARGE).json({ success: false, message: "Team name cannot exceed 16 characters" }); return; }

      const team_repo = getTeamRepository();
      const is_taken = await team_repo.exists({ where: { name: team_name } });
      if (is_taken) { res.status(s.CONFLICT).json({ success: false, message: "Team name already taken" }); return; }

      const team = team_repo.create({ name: team_name });
      await team_repo.save(team);

      const user_repo = getUserRepository();
      req.user!.team     = team;
      req.user!.team_uuid = team.uuid;
      await user_repo.save(req.user!);

      res.status(s.OK).json({ success: true, message: "Team created successfully", data: { team } });
    } catch (error: any) {
      logger.error("Setup team error:", error);
      res.status(s.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
    }
  }

  // ─── Password management ─────────────────────────────────────────────────────

  /**
   * PATCH /auth/password
   * Change password after verifying the current one.
   */
  static async change_password(req: Request, res: Response): Promise<void> {
    try {
      const { old_password, new_password } = req.body;
      await AuthService.change_password(req.user!, old_password, new_password);
      res.status(s.OK).json({ success: true, message: "Password changed successfully" });
    } catch (error: any) {
      logger.error("Change password error:", error);
      res.status(error instanceof MyError ? (error.code || 500) : s.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }

  // ─── TOTP ────────────────────────────────────────────────────────────────────

  /**
   * POST /auth/totp
   * Generate a TOTP secret and return the otpauth URL for QR scanning.
   * Does not enable TOTP until /auth/totp/verify is called.
   */
  static async totp_create(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.totp_create(req.user!);
      res.status(s.OK).json({ success: true, data: result });
    } catch (error: any) {
      logger.error("TOTP create error:", error);
      res.status(error instanceof MyError ? (error.code || 500) : s.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /auth/totp/verify
   * Confirm the scanned secret and enable TOTP.
   */
  static async totp_verify(req: Request, res: Response): Promise<void> {
    try {
      await AuthService.totp_verify(req.user!, req.body.token);
      res.status(s.OK).json({ success: true, message: "TOTP enabled successfully" });
    } catch (error: any) {
      logger.error("TOTP verify error:", error);
      res.status(error instanceof MyError ? (error.code || 500) : s.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }

  /**
   * DELETE /auth/totp
   * Disable TOTP after confirming with a valid token.
   */
  static async totp_disable(req: Request, res: Response): Promise<void> {
    try {
      await AuthService.totp_disable(req.user!, req.body.token);
      res.status(s.OK).json({ success: true, message: "TOTP disabled successfully" });
    } catch (error: any) {
      logger.error("TOTP disable error:", error);
      res.status(error instanceof MyError ? (error.code || 500) : s.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }
}

export { AuthController };
export default AuthController;