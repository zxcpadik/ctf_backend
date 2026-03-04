import { Router } from 'express';
import SubmissionController from '../controllers/submission.controller';
import AuthMiddleware from '../middleware/auth.middleware';
import GameMiddleware from '../middleware/game.middleware';

const router: Router = Router();

const { authenticate, ensure_setup_done, ensure_admin, ensure_team } = AuthMiddleware;
const { ensure_game_running }                                        = GameMiddleware;

// Submit a flag
router.post('/',                  authenticate, ensure_setup_done, ensure_team, ensure_game_running,  SubmissionController.submit);

// Player: own team's solves
router.get('/my-team',            authenticate, ensure_setup_done, ensure_team,  SubmissionController.get_my_team);

// Admin: all submissions, or filtered by team
router.get('/',                   authenticate, ensure_admin,                    SubmissionController.get_all);
router.get('/team/:team_uuid',    authenticate, ensure_admin,                    SubmissionController.get_by_team);

export default router;