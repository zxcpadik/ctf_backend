import { Request, Response, NextFunction } from 'express';
import ConfigService from '../services/config.service';
import logger from '../services/logger.service';

// ─── Game state ───────────────────────────────────────────────────────────────

export type GameState = 'idle' | 'scheduled' | 'running' | 'paused' | 'ended';

export const GAME_STATE_CONFIG     = 'game_state';
export const TASKS_ON_PAUSE_CONFIG = 'tasks_visible_on_pause';

export async function get_game_state(): Promise<GameState> {
  const value = await ConfigService.get_value(GAME_STATE_CONFIG);
  return (value as GameState) ?? 'idle';
}

// ─── Middleware ───────────────────────────────────────────────────────────────

class GameMiddleware {
  /**
   * Allow access to tasks / task-groups for non-admin users.
   * Passes when state is 'running' or 'ended'.
   * Passes when state is 'paused' AND config 'tasks_visible_on_pause' === 'true'.
   * Admins always pass.
   */
  static async ensure_tasks_visible(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.is_admin) return next();

      const state = await get_game_state();

      if (state === 'running' || state === 'ended') return next();

      if (state === 'paused') {
        const visible_on_pause = await ConfigService.get_value(TASKS_ON_PAUSE_CONFIG);
        if (visible_on_pause === 'true') return next();
      }

      const messages: Record<GameState, string> = {
        idle:      "The game has not started yet",
        scheduled: "The game has not started yet",
        paused:    "The game is currently paused",
        ended:     "",  // never reached
        running:   "",  // never reached
      };

      return (res.status(403).json({ success: false, message: messages[state] }), void 0);
    } catch (error) {
      logger.error("Game state check failed:", error);
      return (res.status(500).json({ success: false, message: "Internal server error" }), void 0);
    }
  }

  /**
   * Allow flag submission only when the game is running.
   * Admins always pass.
   */
  static async ensure_game_running(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.is_admin) return next();

      const state = await get_game_state();
      if (state === 'running') return next();

      const messages: Record<GameState, string> = {
        idle:      "The game has not started yet",
        scheduled: "The game has not started yet",
        paused:    "The game is currently paused",
        ended:     "The game has ended",
        running:   "",  // never reached
      };

      return (res.status(403).json({ success: false, message: messages[state] }), void 0);
    } catch (error) {
      logger.error("Game state check failed:", error);
      return (res.status(500).json({ success: false, message: "Internal server error" }), void 0);
    }
  }
}

export { GameMiddleware };
export default GameMiddleware;