import { Router } from 'express';
import GameController from '../controllers/game.controller';
import AuthMiddleware from '../middleware/auth.middleware';

const router: Router = Router();

const { authenticate, ensure_admin } = AuthMiddleware;

router.get('/state',     GameController.get_state);
router.patch('/state',   authenticate, ensure_admin,   GameController.set_state);

export default router;