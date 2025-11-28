import { Request, Response } from 'express';
import GameService from '../services/game.service';
import logger from '../services/logger.service';
import { ResponseInterface } from '../interfaces/response.interface';

class GameController {
  static async getGameStatus(req: Request, res: Response): Promise<void> {
    try {
      const game = await GameService.getGameStatus();

      const response: ResponseInterface = {
        success: true,
        message: "Game status retrieved successfully",
        data: game
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Get game status error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to retrieve game status"
      };

      res.status(500).json(response);
    }
  }

  static async startGame(req: Request, res: Response): Promise<void> {
    try {
      const { playDurationMinutes } = req.body;

      if (!playDurationMinutes || playDurationMinutes <= 0) {
        const response: ResponseInterface = {
          success: false,
          message: "Play duration must be a positive number"
        };
        res.status(400).json(response);
        return;
      }

      const game = await GameService.startGame(playDurationMinutes);

      const response: ResponseInterface = {
        success: true,
        message: "Game started successfully",
        data: game
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Start game error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to start game"
      };

      res.status(400).json(response);
    }
  }

  static async stopGame(req: Request, res: Response): Promise<void> {
    try {
      const game = await GameService.forceStopGame();

      const response: ResponseInterface = {
        success: true,
        message: "Game force stopped successfully",
        data: game
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Force stop game error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to force stop game"
      };

      res.status(400).json(response);
    }
  }

  static async resetGame(req: Request, res: Response): Promise<void> {
    try {
      const game = await GameService.resetGame();

      const response: ResponseInterface = {
        success: true,
        message: "Game reset successfully",
        data: game
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error("Reset game error:", error);

      const response: ResponseInterface = {
        success: false,
        message: error.message || "Failed to reset game"
      };

      res.status(400).json(response);
    }
  }
}

export default GameController;