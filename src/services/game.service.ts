import { getSubmissionRepository } from './database.service';
import logger from './logger.service';
import { Game, GameStatus } from '../entities/Game';
import EventEmitterService from './event-emitter.service';

/**
 * Service for managing the global state and operations of the CTF game.
 * Ensures there's always a single Game instance.
 */
class GameService {
  /**
   * Retrieves the single Game instance, creating it if it doesn't exist.
   * This should be called once at application startup.
   * @returns {Promise<Game>} The Game instance.
   */
  static async getOrCreateGame(): Promise<Game> {
    try {
      return await Game.getGame();
    } catch (error) {
      logger.error("Failed to get or create game instance:", error);
      throw new Error("Critical: Could not initialize game state.");
    }
  }

  /**
   * Gets the current status of the game.
   * @returns {Promise<Game>} The current Game object.
   */
  static async getGameStatus(): Promise<Game> {
    try {
      const game = await Game.getGame();
      // Recalculate status based on current time if game is IN_PROCESS and time has ended
      if (game.status === GameStatus.IN_PROCESS && game.endTime && game.endTime < new Date()) {
        game.status = GameStatus.TIME_ENDED;
        await game.save();
      }
      return game;
    } catch (error) {
      logger.error("Failed to retrieve game status:", error);
      throw new Error("Could not get game status.");
    }
  }

  /**
   * Admin-only: Starts the game, setting the duration and activating all tasks.
   * @param {number} playDurationMinutes - The total duration of the game in minutes.
   * @returns {Promise<Game>} The updated Game instance.
   */
  static async startGame(playDurationMinutes: number): Promise<Game> {
    try {
      if (playDurationMinutes <= 0) {
        throw new Error("Play duration must be a positive number of minutes.");
      }

      const game = await Game.getGame();

      // Only start if not already in progress or time ended
      if (game.status === GameStatus.IN_PROCESS) {
        throw new Error("Game is already in progress.");
      }

      game.status = GameStatus.IN_PROCESS;
      game.startTime = new Date();
      game.endTime = new Date(game.startTime.getTime() + playDurationMinutes * 60 * 1000); // Add minutes
      game.playDuration = playDurationMinutes;
      await game.save();

      logger.info(`Game started successfully. Duration: ${playDurationMinutes} minutes. End time: ${game.endTime}`);
      EventEmitterService.emitGameStateChanged(game);
      return game;
    } catch (error) {
      logger.error("Failed to start game:", error);
      throw error;
    }
  }

  /**
   * Admin-only: Forces the game to stop immediately.
   * @returns {Promise<Game>} The updated Game instance.
   */
  static async forceStopGame(): Promise<Game> {
    try {
      const game = await Game.getGame();

      if (game.status === GameStatus.FORCE_STOPPED) {
        throw new Error("Game is already force stopped.");
      }

      game.status = GameStatus.FORCE_STOPPED;
      game.endTime = new Date(); // Set end time to now
      await game.save();

      logger.info("Game force stopped successfully.");
      EventEmitterService.emitGameStateChanged(game);
      return game;
    } catch (error) {
      logger.error("Failed to force stop game:", error);
      throw error;
    }
  }

  /**
   * Admin-only: Resets the game to WAITING_FOR_START state.
   * This typically means clearing scores and task states too.
   * Note: This does NOT remove teams or users. Use admin.service for that.
   * @returns {Promise<Game>} The reset Game instance.
   */
  static async resetGame(): Promise<Game> {
    try {
      const game = await Game.getGame();

      // Reset game state
      game.status = GameStatus.WAITING_FOR_START;
      game.startTime = null;
      game.endTime = null;
      game.playDuration = null;
      await game.save();

      // Clear all submissions
      const submissionRepository = getSubmissionRepository();
      await submissionRepository.clear(); // CAUTION: This deletes ALL submission records.

      logger.info("Game state, task activity, team scores, and submissions reset.");
      EventEmitterService.emitGameStateChanged(game);
      return game;
    } catch (error) {
      logger.error("Failed to reset game:", error);
      throw error;
    }
  }

  /**
   * Helper to determine if the game is currently active (i.e., players can submit flags).
   * @returns {Promise<boolean>} True if the game is IN_PROCESS and time has not ended, false otherwise.
   */
  static async isGameActive(): Promise<boolean> {
    const game = await GameService.getGameStatus();
    return game.status === GameStatus.IN_PROCESS && (game.endTime ? game.endTime > new Date() : true);
  }
}

export default GameService;