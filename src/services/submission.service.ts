import { getSubmissionRepository, getTaskRepository, getTeamRepository, getUserRepository, getGameRepository } from './database.service';
import logger from './logger.service';
import { Submission } from '../entities/Submission';
import { User } from '../entities/User';
import { GameStatus } from '../entities/Game';
import GameService from './game.service'; // To check game status
import ValidationUtil from '../utils/validation.util';
import { Equal } from 'typeorm'; // For more precise queries

/**
 * Service for handling flag submissions, verification, and score updates.
 * Also includes rate limiting logic.
 */
class SubmissionService {
  // In-memory rate limiting map: { sessionId: { lastSubmissionTime: number, count: number } }
  private static rateLimitMap: Map<string, { lastAttempt: number; count: number }> = new Map();
  private static readonly RATE_LIMIT_COUNT = 10; // Max attempts
  private static readonly RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

  /**
   * Verifies a submitted flag against a task's correct flag.
   * Handles score updates and records the submission.
   * Applies rate limiting per session.
   * @param {string} taskId - The UUID of the task.
   * @param {string} submittedFlag - The flag submitted by the user.
   * @param {User} user - The authenticated user submitting the flag.
   * @param {string} sessionId - The UUID of the user's current session.
   * @param {string} ipAddress - The IP address of the user.
   * @param {string} userAgent - The User-Agent of the user.
   * @returns {Promise<{ isCorrect: boolean, message: string, retryAfter?: number }>} Verification result.
   */
  static async verifyFlag(
    taskId: string,
    submittedFlag: string,
    user: User,
    sessionId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ isCorrect: boolean, message: string, retryAfter?: number }> {
    try {
      if (!ValidationUtil.isValidUuid(taskId)) {
        throw new Error("Invalid task UUID format.");
      }
      if (!ValidationUtil.isNonEmptyString(submittedFlag)) {
        throw new Error("Submitted flag cannot be empty.");
      }
      if (!user.teamId) {
        throw new Error("User is not part of a team.");
      }

      const game = await GameService.getGameStatus();
      if (game.status !== GameStatus.IN_PROCESS || !await GameService.isGameActive()) {
        return { isCorrect: false, message: "The game is not currently active." };
      }

      // Apply rate limiting
      const rateLimitInfo = SubmissionService.rateLimitMap.get(sessionId) || { lastAttempt: 0, count: 0 };
      const currentTime = Date.now();

      if (currentTime - rateLimitInfo.lastAttempt > SubmissionService.RATE_LIMIT_WINDOW_MS) {
        // Reset count if window has passed
        rateLimitInfo.count = 0;
      }

      if (rateLimitInfo.count >= SubmissionService.RATE_LIMIT_COUNT) {
        const retryAfter = Math.ceil(
          (SubmissionService.RATE_LIMIT_WINDOW_MS - (currentTime - rateLimitInfo.lastAttempt)) / 1000
        );
        return {
          isCorrect: false,
          message: "Rate limit exceeded. Please try again later.",
          retryAfter
        };
      }

      // Update rate limit info
      rateLimitInfo.count++;
      rateLimitInfo.lastAttempt = currentTime;
      SubmissionService.rateLimitMap.set(sessionId, rateLimitInfo);

      const taskRepository = getTaskRepository();
      const submissionRepository = getSubmissionRepository();
      const teamRepository = getTeamRepository();

      const task = await taskRepository.findOne({
        where: { uuid: taskId, isActive: true }
      });

      if (!task) {
        return { isCorrect: false, message: "Task not found or inactive." };
      }

      // Check if user has already solved this task
      const existingCorrectSubmission = await submissionRepository.findOne({
        where: {
          userId: user.uuid,
          taskId: task.uuid,
          isCorrect: true
        }
      });

      if (existingCorrectSubmission) {
        return { isCorrect: false, message: "You have already solved this task." };
      }

      const isCorrect = submittedFlag.trim() === task.flag;
      const submission = submissionRepository.create({
        user,
        userId: user.uuid,
        task,
        taskId: task.uuid,
        teamId: user.teamId,
        submittedFlag,
        isCorrect,
        ipAddress,
        userAgent,
        timestamp: new Date()
      });

      await submissionRepository.save(submission);

      if (isCorrect) {
        // Update team score
        const team = await teamRepository.findOne({ where: { uuid: user.teamId } });
        if (team) {
          team.score += task.score;
          await teamRepository.save(team);
        }
        return { isCorrect: true, message: "Correct flag! Points awarded." };
      } else {
        return { isCorrect: false, message: "Incorrect flag." };
      }
    } catch (error) {
      logger.error("Flag verification error:", error);
      throw new Error("Failed to verify flag.");
    }
  }

  /**
   * Gets all submissions for admin review.
   * @returns {Promise<Submission[]>} Array of all submissions.
   */
  static async getAllSubmissions(): Promise<Submission[]> {
    try {
      const submissionRepository = getSubmissionRepository();
      return await submissionRepository.find({
        relations: ['user', 'task', 'team'],
        order: { timestamp: 'DESC' }
      });
    } catch (error) {
      logger.error("Failed to get submissions:", error);
      throw error;
    }
  }

  /**
   * Gets submissions by team ID
   */
  static async getSubmissionsByTeam(teamId: string): Promise<Submission[]> {
    try {
      if (!ValidationUtil.isValidUuid(teamId)) {
        throw new Error("Invalid team UUID format.");
      }

      const submissionRepository = getSubmissionRepository();
      return await submissionRepository.find({
        where: { teamId },
        relations: ['user', 'task'],
        order: { timestamp: 'DESC' }
      });
    } catch (error) {
      logger.error(`Failed to get submissions for team ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Gets submissions by user ID
   */
  static async getUserSubmissions(userId: string): Promise<Submission[]> {
    try {
      if (!ValidationUtil.isValidUuid(userId)) {
        throw new Error("Invalid user UUID format.");
      }

      const submissionRepository = getSubmissionRepository();
      return await submissionRepository.find({
        where: { userId },
        relations: ['task'],
        order: { timestamp: 'DESC' }
      });
    } catch (error) {
      logger.error(`Failed to get submissions for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Clears the rate limit map (useful for testing or resetting).
   */
  static clearRateLimit(): void {
    SubmissionService.rateLimitMap.clear();
  }
}

export default SubmissionService;