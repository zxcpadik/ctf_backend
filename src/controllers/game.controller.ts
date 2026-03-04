import { Request, Response } from 'express';
import ConfigService from '../services/config.service';
import logger from '../services/logger.service';
import MyError from '../utils/myerror.util';
import { GameState, GAME_STATE_CONFIG, get_game_state } from '../middleware/game.middleware';
import s from "http-status";

const GAME_SCHEDULE_START_CONFIG = 'game_schedule_start';

class GameController {
  /**
   * GET /game/state
   * Public — returns the current game state.
   */
  static async get_state(req: Request, res: Response): Promise<void> {
    try {
      const state = await get_game_state();
      return (res.status(s.OK).json({ success: true, data: { state } }), void 0);
    } catch (error: any) {
      logger.error("Get game state error:", error);
      return (res.status(s.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message }), void 0);
    }
  }

  /**
   * PATCH /game/state
   * Admin only — transition to any valid game state.
   * Body: { state: 'idle' | 'scheduled' | 'running' | 'paused' | 'ended' }
   *
   * Transitioning to 'scheduled' requires config 'game_schedule_start' to be
   * set to a valid UTC timestamp (ms) that is in the future.
   */
  static async set_state(req: Request, res: Response): Promise<void> {
    try {
      const { state } = req.body as { state: GameState };

      // Ensure game_state config entry exists (must be seeded on init)
      const game_state_config = await ConfigService.get_by_name(GAME_STATE_CONFIG);
      if (!game_state_config) return (res.status(s.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: `Config '${GAME_STATE_CONFIG}' is not initialised. Run the seed script.`,
      }), void 0);

      // Validate against the config's own option list (LIST type = single value from options)
      const valid_options: { label: string, value: string }[] = await game_state_config.options();
      const valid_values = valid_options.map(o => o.value);
      if (!valid_values.includes(state)) return (res.status(s.BAD_REQUEST).json({
        success: false,
        message: `Invalid state. Must be one of: ${valid_values.join(', ')}`,
      }), void 0);

      // Extra validation for 'scheduled': game_schedule_start must be present and in the future
      if (state === 'scheduled') {
        const schedule_config = await ConfigService.get_by_name(GAME_SCHEDULE_START_CONFIG);
        const raw = schedule_config?.value ?? schedule_config?.default_value ?? null;

        if (!raw) return (res.status(s.BAD_REQUEST).json({
          success: false,
          message: `Config '${GAME_SCHEDULE_START_CONFIG}' must be set before scheduling the game`,
        }), void 0);

        const ts = Number(raw);
        if (!Number.isFinite(ts)) return (res.status(s.BAD_REQUEST).json({
          success: false,
          message: `Config '${GAME_SCHEDULE_START_CONFIG}' is not a valid numeric timestamp`,
        }), void 0);

        if (ts <= Date.now()) return (res.status(s.BAD_REQUEST).json({
          success: false,
          message: `Config '${GAME_SCHEDULE_START_CONFIG}' must be a future UTC timestamp (ms)`,
        }), void 0);
      }

      await ConfigService.set_value(GAME_STATE_CONFIG, state);
      logger.info(`Game state set to '${state}' by admin ${req.user!.uuid}`);
      return (res.status(s.OK).json({ success: true, message: `Game state set to '${state}'`, data: { state } }), void 0);
    } catch (error: any) {
      logger.error("Set game state error:", error);
      return (res.status(error instanceof MyError ? (error.code || s.INTERNAL_SERVER_ERROR) : s.BAD_REQUEST).json({
        success: false,
        message: error.message,
      }), void 0);
    }
  }
}

export { GameController };
export default GameController;