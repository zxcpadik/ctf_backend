import { Router } from 'express';
import AuthController from '../controllers/auth.controller';
import AuthMiddleware from '../middleware/auth.middleware';

const router: Router = Router();

const { authenticate, ensure_setup_done, ensure_stage, ensure_leader } = AuthMiddleware;

// Public
router.post('/login',                authenticate,                                         AuthController.login);
router.post('/logout',               authenticate,                                         AuthController.logout);

// Current user (any authenticated user)
router.get('/me',                    authenticate,                                         AuthController.me);

// ── Setup pipeline (ordered, enforced by ensure_stage) ────────────────────────
router.patch('/setup/password',      authenticate, ensure_stage('password'),               AuthController.setup_password);
router.patch('/setup/profile',       authenticate, ensure_stage('profile'),                AuthController.setup_profile);
router.patch('/setup/team',          authenticate, ensure_stage('team'),   ensure_leader,  AuthController.setup_team);

// ── Post-setup account management ─────────────────────────────────────────────
router.patch('/password',            authenticate, ensure_setup_done,                      AuthController.change_password);
router.post('/totp',                 authenticate, ensure_setup_done,                      AuthController.totp_create);
router.post('/totp/verify',          authenticate, ensure_setup_done,                      AuthController.totp_verify);
router.delete('/totp',               authenticate, ensure_setup_done,                      AuthController.totp_disable);

export default router;