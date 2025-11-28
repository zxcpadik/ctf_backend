import { Router } from 'express';
import GameController from '../controllers/game.controller';
import AuthMiddleware from '../middleware/auth.middleware';

const router: Router = Router();

// Game Status
router.get('/status', GameController.getGameStatus);

// Game Control (Admin only)
router.post('/start', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, GameController.startGame);
router.post('/stop', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, GameController.stopGame);
router.post('/reset', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, GameController.resetGame);

export default router;