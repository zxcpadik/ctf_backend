import { Request, Response } from 'express';
import AuthService from '../services/auth.service';
import TeamService from '../services/team.service';
import UserService, { UserDeleteStrategy_ } from '../services/user.service';
import SubmissionService from '../services/submission.service';
import TaskService from '../services/task.service';
import logger from '../services/logger.service';
import MyError from '../utils/myerror.util';
import s from "http-status";

class AdminController {
  // ─── Statistics ──────────────────────────────────────────────────────────────

  /**
   * GET /admin/statistics
   * Overall platform counts.
   */
  static async get_statistics(req: Request, res: Response): Promise<void> {
    try {
      const [teams, users, submissions, tasks] = await Promise.all([
        TeamService.get_all(),
        UserService.get_all(),
        SubmissionService.get_all(),
        TaskService.get_all(),
      ]);

      return (res.status(s.OK).json({
        success: true,
        data: {
          teams:       teams.length,
          users:       users.length,
          leaders:     users.filter(u => u.is_leader).length,
          solves:      submissions.length,
          tasks:       tasks.length,
          tasks_active: tasks.filter(t => t.is_active).length,
        },
      }), void 0);
    } catch (error: any) {
      logger.error("Get admin statistics error:", error);
      return (res.status(error instanceof MyError ? (error.code || 500) : s.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message }), void 0);
    }
  }

  // ─── Team management ─────────────────────────────────────────────────────────

  /**
   * GET /admin/teams
   * All teams with their members.
   */
  static async get_all_teams(req: Request, res: Response): Promise<void> {
    try {
      const teams = await TeamService.get_all(['users', 'submissions']);
      return (res.status(s.OK).json({ success: true, data: teams }), void 0);
    } catch (error: any) {
      logger.error("Get all teams error:", error);
      return (res.status(error instanceof MyError ? (error.code || 500) : s.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message }), void 0);
    }
  }

  /**
   * GET /admin/teams/:team_uuid
   * Single team with members and submissions.
   */
  static async get_team(req: Request, res: Response): Promise<void> {
    try {
      const team = await TeamService.get(req.params.team_uuid as string, ['users', 'submissions']);
      if (!team) return (res.status(s.NOT_FOUND).json({ success: false, message: "Team not found" }), void 0);

      const solves = await SubmissionService.get_all_team(team.uuid, ['task']);
      return (res.status(s.OK).json({
        success: true,
        data: {
          ...team,
          solves_count: solves.length,
          solves,
        },
      }), void 0);
    } catch (error: any) {
      logger.error("Get team error:", error);
      return (res.status(error instanceof MyError ? (error.code || 500) : s.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message }), void 0);
    }
  }

  /**
   * DELETE /admin/teams/:team_uuid
   * Delete a single team and all its members.
   */
  static async delete_team(req: Request, res: Response): Promise<void> {
    try {
      await TeamService.delete(req.params.team_uuid as string);
      return (res.status(s.OK).json({ success: true, message: "Team deleted successfully" }), void 0);
    } catch (error: any) {
      logger.error("Delete team error:", error);
      return (res.status(error instanceof MyError ? (error.code || 500) : s.BAD_REQUEST).json({ success: false, message: error.message }), void 0);
    }
  }

  /**
   * DELETE /admin/teams
   * Delete ALL teams and their members.
   * Requires body: { confirm: "DELETE_ALL_TEAMS" } as a deliberate safety gate.
   */
  static async delete_all_teams(req: Request, res: Response): Promise<void> {
    try {
      if (req.body?.confirm !== "DELETE_ALL_TEAMS")
        return (res.status(s.BAD_REQUEST).json({
          success: false,
          message: 'Send { "confirm": "DELETE_ALL_TEAMS" } in the request body to proceed',
        }), void 0);

      const teams = await TeamService.get_all();
      await Promise.all(teams.map(t => TeamService.delete(t)));
      logger.warn(`All ${teams.length} teams deleted by admin ${req.user!.uuid}`);
      return (res.status(s.OK).json({ success: true, message: `${teams.length} team(s) deleted` }), void 0);
    } catch (error: any) {
      logger.error("Delete all teams error:", error);
      return (res.status(error instanceof MyError ? (error.code || 500) : s.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message }), void 0);
    }
  }

  // ─── User management ─────────────────────────────────────────────────────────

  /**
   * GET /admin/users
   * All users with their team relation.
   */
  static async get_all_users(req: Request, res: Response): Promise<void> {
    try {
      const users = await UserService.get_all(['team']);
      return (res.status(s.OK).json({ success: true, data: users }), void 0);
    } catch (error: any) {
      logger.error("Get all users error:", error);
      return (res.status(error instanceof MyError ? (error.code || 500) : s.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message }), void 0);
    }
  }

  /**
   * DELETE /admin/users/:user_uuid
   * Delete a single user.
   */
  static async delete_user(req: Request, res: Response): Promise<void> {
    try {
      if (req.params.user_uuid === req.user!.uuid) return (res.status(s.BAD_REQUEST).json({ success: false, message: "You cannot delete yourself" }), void 0);
      const strategy = req.body.strategy;
      if (strategy && !UserDeleteStrategy_.includes(strategy)) return (res.status(s.BAD_REQUEST).json({ success: false, message: `Delete strategy inavlid. valid options: [${UserDeleteStrategy_.join(' ,')}]` }), void 0);

      await UserService.delete(req.params.user_uuid, strategy);
      return (res.status(s.OK).json({ success: true, message: "User deleted successfully" }), void 0);
    } catch (error: any) {
      logger.error("Delete user error:", error);
      return (res.status(error instanceof MyError ? (error.code || 500) : s.BAD_REQUEST).json({ success: false, message: error.message }), void 0);
    }
  }

  // ─── Code generation ─────────────────────────────────────────────────────────

  /**
   * POST /admin/codes/team-leader
   * Generate a one-time auth code for a new team leader.
   */
  static async generate_leader_code(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.generate_auth_code();
      return (res.status(s.CREATED).json({ success: true, data: result }), void 0);
    } catch (error: any) {
      logger.error("Generate leader code error:", error);
      return (res.status(error instanceof MyError ? (error.code || 500) : s.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message }), void 0);
    }
  }
}

export { AdminController };
export default AdminController;