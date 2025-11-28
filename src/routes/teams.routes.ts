import { Router } from 'express';
import TeamController from '../controllers/team.controller';
import AuthMiddleware from '../middleware/auth.middleware';

const router: Router = Router();

// My Team
router.get('/me', AuthMiddleware.authenticate, AuthMiddleware.ensureAccountFinalized, AuthMiddleware.hasTeam, TeamController.getMyTeam);
router.get('/me/score', AuthMiddleware.authenticate, AuthMiddleware.ensureAccountFinalized, AuthMiddleware.hasTeam, TeamController.getMyTeamScore);
router.get('/me/solves', AuthMiddleware.authenticate, AuthMiddleware.ensureAccountFinalized, TeamController.getMyTeamSolves);
router.get('/me/statistics', AuthMiddleware.authenticate, AuthMiddleware.ensureAccountFinalized, TeamController.getMyTeamStatistics);

// Team Members
router.get('/me/members', AuthMiddleware.authenticate, AuthMiddleware.ensureAccountFinalized, TeamController.getTeamMembers);
router.delete('/me/members/:userId', AuthMiddleware.authenticate, AuthMiddleware.ensureLeader, TeamController.removeMember);

// Team Codes (Leader only)
router.post('/me/codes/member', AuthMiddleware.authenticate, AuthMiddleware.ensureLeader, TeamController.generateMemberCode);

// Team Management
router.patch('/me/name', AuthMiddleware.authenticate, AuthMiddleware.ensureLeader, TeamController.updateTeamName);
// router.delete('/me', AuthMiddleware.authenticate, AuthMiddleware.ensureLeader, TeamController.disbandTeam);

export default router;