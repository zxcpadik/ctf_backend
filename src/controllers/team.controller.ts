import { Request, Response } from 'express';
import AuthService from '../services/auth.service';
import TeamService from '../services/team.service';
import UserService from '../services/user.service';
import ConfigService from '../services/config.service';
import logger from '../services/logger.service';
import MyError from '../utils/myerror.util';
import { get_game_state } from '../middleware/game.middleware';
import s from "http-status";

// Config keys for game-time permission flags
const CFG_ALLOW_INVITES_DURING_GAME         = 'allow_invites_during_game';
const CFG_ALLOW_TEAM_NAME_DURING_GAME       = 'allow_team_name_change_during_game';
const CFG_ALLOW_MEMBER_DELETION_DURING_GAME = 'allow_member_deletion_during_game';

/** Returns true when the game is in an "active" state (running or paused). */
async function is_game_active(): Promise<boolean> {
  const state = await get_game_state();
  return state === 'running' || state === 'paused';
}

/** Returns true when a boolean config flag is explicitly set to 'true'. */
async function flag_enabled(config_name: string): Promise<boolean> {
  return (await ConfigService.get_value(config_name)) === 'true';
}

class TeamController {
  /**
   * GET /teams/me
   * Current user's full team with members.
   */
  static async get_my_team(req: Request, res: Response): Promise<void> {
    try {
      const team = await TeamService.get(req.team_uuid!, ['users']);
      if (!team) return (res.status(s.NOT_FOUND).json({ success: false, message: "Team not found" }), void 0);
      return (res.status(s.OK).json({ success: true, data: team }), void 0);
    } catch (error: any) {
      logger.error("Get my team error:", error);
      return (res.status(error instanceof MyError ? (error.code || 500) : s.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message }), void 0);
    }
  }

  /**
   * GET /teams/me/members
   * List all members of the current user's team.
   */
  static async get_members(req: Request, res: Response): Promise<void> {
    try {
      const team = await TeamService.get(req.team_uuid!, ['users']);
      if (!team) return (res.status(s.NOT_FOUND).json({ success: false, message: "Team not found" }), void 0);
      return (res.status(s.OK).json({ success: true, data: team.users }), void 0);
    } catch (error: any) {
      logger.error("Get team members error:", error);
      return (res.status(error instanceof MyError ? (error.code || 500) : s.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message }), void 0);
    }
  }

  /**
   * DELETE /teams/me/members/:user_uuid
   * Leader only — remove a member from the team.
   * Allowed when state is idle or scheduled.
   * Allowed during running/paused only if config 'allow_member_deletion_during_game' = true.
   */
  static async remove_member(req: Request, res: Response): Promise<void> {
    try {
      const { user_uuid } = req.params;

      if (user_uuid === req.user!.uuid) return (res.status(s.BAD_REQUEST).json({ success: false, message: "You cannot remove yourself" }), void 0);

      // Game state gate
      const game_active = await is_game_active();
      if (game_active && !await flag_enabled(CFG_ALLOW_MEMBER_DELETION_DURING_GAME)) return (res.status(s.FORBIDDEN).json({ success: false, message: "Member removal is disabled while the game is active" }), void 0);

      const state = await get_game_state();
      if (state === 'ended') return (res.status(s.FORBIDDEN).json({ success: false, message: "Member removal is not allowed after the game has ended" }), void 0);

      // Verify the target user actually belongs to the leader's team
      const target = await UserService.get(user_uuid as string);
      if (!target) return (res.status(s.NOT_FOUND).json({ success: false, message: "User not found" }), void 0);
      if (target.team_uuid !== req.team_uuid) return (res.status(s.FORBIDDEN).json({ success: false, message: "User is not a member of your team" }), void 0);

      await UserService.delete(user_uuid, 'ignore');
      return (res.status(s.OK).json({ success: true, message: "Member removed successfully" }), void 0);
    } catch (error: any) {
      logger.error("Remove team member error:", error);
      return (res.status(error instanceof MyError ? (error.code || 500) : s.BAD_REQUEST).json({ success: false, message: error.message }), void 0);
    }
  }

  /**
   * POST /teams/me/invite
   * Leader only — regenerate the team invite code.
   * Blocked during running/paused unless 'allow_invites_during_game' = true.
   */
  static async generate_invite(req: Request, res: Response): Promise<void> {
    try {
      const game_active = await is_game_active();
      if (game_active && !await flag_enabled(CFG_ALLOW_INVITES_DURING_GAME))
        return (res.status(s.FORBIDDEN).json({ success: false, message: "Team invites are disabled while the game is active" }), void 0);

      const code = await AuthService.generate_share_code(req.user!);
      return (res.status(s.OK).json({ success: true, data: { invite_code: code } }), void 0);
    } catch (error: any) {
      logger.error("Generate invite code error:", error);
      return (res.status(error instanceof MyError ? (error.code || 500) : s.BAD_REQUEST).json({ success: false, message: error.message }), void 0);
    }
  }

  /**
   * PATCH /teams/me/name
   * Leader only — rename the team.
   * Blocked during running/paused unless 'allow_team_name_change_during_game' = true.
   */
  static async update_name(req: Request, res: Response): Promise<void> {
    try {
      const game_active = await is_game_active();
      if (game_active && !await flag_enabled(CFG_ALLOW_TEAM_NAME_DURING_GAME))
        return (res.status(s.FORBIDDEN).json({ success: false, message: "Team name changes are disabled while the game is active" }), void 0);

      const team = await TeamService.update_name(req.team_uuid!, req.body.team_name);
      return (res.status(s.OK).json({ success: true, message: "Team name updated successfully", data: team }), void 0);
    } catch (error: any) {
      logger.error("Update team name error:", error);
      return (res.status(error instanceof MyError ? (error.code || 500) : s.BAD_REQUEST).json({ success: false, message: error.message }), void 0);
    }
  }
}

export { TeamController };
export default TeamController;