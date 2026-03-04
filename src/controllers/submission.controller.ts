import { Request, Response } from 'express';
import SubmissionService from '../services/submission.service';
import logger from '../services/logger.service';
import MyError from '../utils/myerror.util';

class SubmissionController {
  /**
   * POST /submissions
   * Submit a flag for a task. Only records correct solves, once per team.
   */
  static async submit(req: Request, res: Response): Promise<void> {
    try {
      const { task_uuid, flag } = req.body;

      const result = await SubmissionService.verify(task_uuid, flag, req.user!);

      res.status(200).json({ success: result.is_correct, message: result.message });
    } catch (error: any) {
      logger.error("Submit flag error:", error);
      res.status(error instanceof MyError ? (error.code || 400) : 400).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /submissions
   * Admin: get all submissions across all teams.
   */
  static async get_all(req: Request, res: Response): Promise<void> {
    try {
      const submissions = await SubmissionService.get_all(['user', 'task', 'team']);
      res.status(200).json({ success: true, data: submissions });
    } catch (error: any) {
      logger.error("Get all submissions error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /submissions/team/:team_uuid
   * Admin: get all submissions for a specific team.
   */
  static async get_by_team(req: Request, res: Response): Promise<void> {
    try {
      const submissions = await SubmissionService.get_all_team(req.params.team_uuid, ['user', 'task']);
      res.status(200).json({ success: true, data: submissions });
    } catch (error: any) {
      logger.error("Get team submissions error:", error);
      res.status(error instanceof MyError ? (error.code || 500) : 500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /submissions/my-team
   * Player/Leader: get all solves for the current user's team.
   */
  static async get_my_team(req: Request, res: Response): Promise<void> {
    try {
      const submissions = await SubmissionService.get_all_team(req.team_uuid!, ['task']);
      res.status(200).json({ success: true, data: submissions });
    } catch (error: any) {
      logger.error("Get my team submissions error:", error);
      res.status(error instanceof MyError ? (error.code || 500) : 500).json({ success: false, message: error.message });
    }
  }
}

export { SubmissionController };
export default SubmissionController;