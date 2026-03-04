import { Router } from 'express';
import TeamController from '../controllers/team.controller';
import AuthMiddleware from '../middleware/auth.middleware';

const router: Router = Router();

const { authenticate, ensure_setup_done, ensure_leader, ensure_team } = AuthMiddleware;

// All team routes require a complete account and team membership
router.get('/me',                       authenticate, ensure_setup_done, ensure_team,                  TeamController.get_my_team);
router.get('/me/members',               authenticate, ensure_setup_done, ensure_team,                  TeamController.get_members);
router.delete('/me/members/:user_uuid', authenticate, ensure_setup_done, ensure_team, ensure_leader,   TeamController.remove_member);
router.post('/me/invite',               authenticate, ensure_setup_done, ensure_team, ensure_leader,   TeamController.generate_invite);
router.patch('/me/name',                authenticate, ensure_setup_done, ensure_team, ensure_leader,   TeamController.update_name);

export default router;