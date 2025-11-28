import { Router } from 'express';
import SubmissionController from '../controllers/submission.controller';
import AuthMiddleware from '../middleware/auth.middleware';

const router: Router = Router();

// Flag Submission
router.post('/', AuthMiddleware.authenticate, AuthMiddleware.ensureAccountFinalized, SubmissionController.submitFlag);

// Submission Management (Admin)
router.get('/', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, SubmissionController.getAllSubmissions);
router.get('/team/:teamId', AuthMiddleware.authenticate, AuthMiddleware.ensureAdmin, SubmissionController.getSubmissionsByTeam);

// My Submissions
router.get('/me', AuthMiddleware.authenticate, AuthMiddleware.ensureAccountFinalized, SubmissionController.getMySubmissions);

export default router;