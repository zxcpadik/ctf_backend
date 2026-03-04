import { Router } from 'express';
import ConfigController from '../controllers/config.controller';
import AuthMiddleware from '../middleware/auth.middleware';

const router: Router = Router();

const { authenticate, ensure_admin } = AuthMiddleware;

// All config routes are admin-only
router.get('/',                         authenticate, ensure_admin,   ConfigController.get_all);
router.post('/',                        authenticate, ensure_admin,   ConfigController.create);
router.get('/:config_uuid',             authenticate, ensure_admin,   ConfigController.get);
router.put('/:config_uuid',             authenticate, ensure_admin,   ConfigController.update);
router.patch('/:config_uuid/value',     authenticate, ensure_admin,   ConfigController.set_value);
router.delete('/:config_uuid',          authenticate, ensure_admin,   ConfigController.delete);

export default router;