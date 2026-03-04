import { getSubmissionRepository, getTaskRepository, getTeamRepository } from './database.service';
import logger from './logger.service';
import { Submission } from '../entities/Submission';
import { User } from '../entities/User';
import ValidationUtil from '../utils/validation.util';
import MyError from '../utils/myerror.util';
import s from "http-status";

export type SubmissionRelation = 'user' | 'task' | 'team';

class SubmissionService {
  /**
   * Verify a submitted flag against a task's correct flag.
   * Records the submission only if the flag is correct.
   * A task can only be solved once per team.
   */
  static async verify(
    task_uuid: string,
    submitted_flag: string,
    user: User,
  ): Promise<{ is_correct: boolean, message: string }> {
    try {
      if (!ValidationUtil.isValidUuid(task_uuid)) throw new MyError("Invalid task UUID", { code: s.BAD_REQUEST });
      if (!ValidationUtil.isNonEmptyString(submitted_flag)) throw new MyError("Submitted flag cannot be empty", { code: s.UNPROCESSABLE_ENTITY });
      if (!user.team_uuid) throw new MyError("User is not part of a team", { code: s.FORBIDDEN });

      const task_repo = getTaskRepository();
      const submission_repo = getSubmissionRepository();
      const team_repo = getTeamRepository();

      const task = await task_repo.findOne({ where: { uuid: task_uuid, is_active: true } });
      if (!task) throw new MyError("Task not found or inactive", { code: s.NOT_FOUND });

      // Check if the team has already solved this task
      const already_solved = await submission_repo.exists({
        where: { task_uuid: task.uuid, team_uuid: user.team_uuid }
      });
      if (already_solved) throw new MyError("Your team has already solved this task", { code: s.CONFLICT });


      const is_correct = task.is_case_sensitive ? (submitted_flag.trim() === task.flag) : (submitted_flag.trim().toLowerCase() === task.flag.toLowerCase());
      if (!is_correct) return { is_correct: false, message: "Incorrect flag" };

      // Record the correct submission and update team score
      const submission = submission_repo.create({
        user,
        user_uuid: user.uuid,
        task,
        task_uuid: task.uuid,
        team_uuid: user.team_uuid,
      });
      await submission_repo.save(submission);

      const team = await team_repo.findOne({ where: { uuid: user.team_uuid } });
      if (team) {
        team.score += task.score;
        await team_repo.save(team);
      }

      logger.info(`Task '${task.uuid}' solved by user '${user.uuid}' (team '${user.team_uuid}')`);
      return { is_correct: true, message: "Correct flag! Points awarded" };
    } catch (error) {
      logger.error("Flag verification error:", error);
      throw error;
    }
  }

  /**
   * Get all submissions.
   */
  static async get_all(relations: SubmissionRelation[] = []): Promise<Submission[]> {
    try {
      const submission_repo = getSubmissionRepository();
      return await submission_repo.find({
        relations,
        order: { timestamp: 'DESC' },
      });
    } catch (error) {
      logger.error("Failed to get all submissions:", error);
      throw error;
    }
  }

  /**
   * Get all submissions for a specific team.
   */
  static async get_all_team(team_uuid: any, relations: SubmissionRelation[] = []): Promise<Submission[]> {
    try {
      if (!ValidationUtil.isValidUuid(team_uuid)) throw new MyError("Invalid team UUID", { code: s.BAD_REQUEST });

      const submission_repo = getSubmissionRepository();
      return await submission_repo.find({
        where: { team_uuid },
        relations,
        order: { timestamp: 'DESC' },
      });
    } catch (error) {
      logger.error(`Failed to get submissions for team ${team_uuid}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific submission by UUID.
   */
  static async get(submission_uuid: string, relations: SubmissionRelation[] = []): Promise<Submission | null> {
    try {
      if (!ValidationUtil.isValidUuid(submission_uuid)) throw new MyError("Invalid submission UUID", { code: s.BAD_REQUEST });

      const submission_repo = getSubmissionRepository();
      return await submission_repo.findOne({ where: { uuid: submission_uuid }, relations });
    } catch (error) {
      logger.error(`Failed to get submission ${submission_uuid}:`, error);
      throw error;
    }
  }

  /**
   * Delete a submission by UUID.
   */
  static async delete(submission_uuid: string | Submission): Promise<void> {
    try {
      if (typeof submission_uuid == "string" && !ValidationUtil.isValidUuid(submission_uuid)) throw new MyError("Invalid submission UUID", { code: s.BAD_REQUEST });

      const submission_repo = getSubmissionRepository();
      const submission = typeof submission_uuid == "string" ? (await submission_repo.findOne({ where: { uuid: submission_uuid } })) : submission_uuid;
      if (!submission) throw new MyError("Submission not found", { code: s.NOT_FOUND });

      await submission_repo.remove(submission);
      logger.info(`Submission ${submission.uuid} deleted`);
    } catch (error) {
      logger.error(`Failed to delete submission ${typeof submission_uuid == "string" ? submission_uuid : submission_uuid?.uuid}:`, error);
      throw error;
    }
  }
}

export { SubmissionService };
export default SubmissionService;