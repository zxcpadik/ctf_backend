import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getSessionRepository } from '../services/database.service';
import Environment from '../config/environment';
import logger from '../services/logger.service';
import { Session } from '../entities/Session';
import { User } from '../entities/User';

// ─── Setup stage ──────────────────────────────────────────────────────────────

/**
 * Ordered setup stages every user must complete before accessing the app.
 * Stage is re-derived from the User entity on every authenticated request,
 * so relogs never skip a stage.
 *
 *  password  →  All users:   must set a password
 *  profile   →  All users:   must set a display name
 *  team      →  Leaders only: must create a team
 *  done      →  Setup complete, full access granted
 */
export type SetupStage = 'password' | 'profile' | 'team' | 'done';

export function get_setup_stage(user: User): SetupStage {
  if (!user.password_hash)                      return 'password';
  if (!user.name)                               return 'profile';
  if (user.is_leader && !user.team_uuid)        return 'team';
  return 'done';
}

// ─── Request augmentation ────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      session?:     Session;
      user?:        User;
      is_admin?:    boolean;
      is_leader?:   boolean;
      team_uuid?:   string;
      setup_stage?: SetupStage;
    }
  }
}

interface JwtPayload {
  session_uuid: string;
}

// ─── Middleware ───────────────────────────────────────────────────────────────

class AuthMiddleware {
  /**
   * Verify JWT, validate session, and populate req.user / req.setup_stage.
   * Always attaches setup_stage — downstream middleware and controllers can
   * inspect it without re-computing.
   */
  static async authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    const auth_header = req.headers.authorization;
    if (!auth_header?.startsWith('Bearer ')) {
      return AuthMiddleware._unauthorized(res, "Missing or invalid authorization header");
    }

    const token = auth_header.split(' ')[1];

    try {
      const decoded = jwt.verify(token, Environment.JWT_SECRET) as JwtPayload;

      const session_repo = getSessionRepository();
      const session = await session_repo.findOne({
        where: { uuid: decoded.session_uuid },
        relations: ['user'],
      });

      if (!session || session.expires_at < new Date()) {
        logger.warn(`Session expired or not found: ${decoded.session_uuid}`);
        return AuthMiddleware._unauthorized(res, "Session expired or invalid");
      }

      if (session.user_agent !== req.headers['user-agent']) {
        logger.warn(`User-Agent mismatch for session ${decoded.session_uuid}`);
        return AuthMiddleware._unauthorized(res, "User-Agent mismatch");
      }

      const user = session.user;
      if (!user) {
        logger.error(`User missing for session ${session.uuid}`);
        return AuthMiddleware._unauthorized(res, "Associated user not found");
      }

      req.session     = session;
      req.user        = user;
      req.is_admin    = user.is_admin;
      req.is_leader   = user.is_leader;
      req.team_uuid   = user.team_uuid ?? undefined;
      req.setup_stage = get_setup_stage(user);

      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        logger.warn(`Invalid JWT: ${error.message}`);
        return AuthMiddleware._unauthorized(res, "Invalid token");
      }
      logger.error("Unexpected authentication error:", error);
      res.status(500).json({ message: "Internal server error during authentication" });
    }
  }

  /**
   * Block access until setup is fully complete.
   * Attach this after `authenticate` on any route that requires a live account.
   * Returns 403 with the current stage so the client knows where to resume.
   */
  static ensure_setup_done(req: Request, res: Response, next: NextFunction): void {
    if (req.setup_stage !== 'done') {
      return AuthMiddleware._forbidden(res, `Account setup incomplete`, req.setup_stage);
    }
    next();
  }

  /**
   * Allow access only up to and including the given stage.
   * Used to protect setup endpoints themselves — e.g. the "set password"
   * endpoint should only be reachable when setup_stage === 'password'.
   */
  static ensure_stage(expected: SetupStage) {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (req.setup_stage !== expected) {
        // If already past this stage, treat as forbidden (don't re-do)
        // If not yet at this stage, also forbidden (wrong order)
        return AuthMiddleware._forbidden(
          res,
          `This action is not available at setup stage '${req.setup_stage}'`,
          req.setup_stage
        );
      }
      next();
    };
  }

  /**
   * Ensure the authenticated user is an admin.
   */
  static ensure_admin(req: Request, res: Response, next: NextFunction): void {
    if (!req.is_admin) {
      return AuthMiddleware._forbidden(res, "Admin privileges required");
    }
    next();
  }

  /**
   * Ensure the authenticated user is a team leader.
   */
  static ensure_leader(req: Request, res: Response, next: NextFunction): void {
    if (!req.is_leader) {
      return AuthMiddleware._forbidden(res, "Team leader privileges required");
    }
    next();
  }

  /**
   * Ensure the user belongs to a team.
   */
  static ensure_team(req: Request, res: Response, next: NextFunction): void {
    if (!req.team_uuid) {
      return AuthMiddleware._forbidden(res, "You must be part of a team to do this");
    }
    next();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private static _unauthorized(res: Response, message: string): void {
    res.status(401).json({ message });
  }

  private static _forbidden(res: Response, message: string, setup_stage?: SetupStage): void {
    res.status(403).json({ message, ...(setup_stage ? { setup_stage } : {}) });
  }
}

export default AuthMiddleware;