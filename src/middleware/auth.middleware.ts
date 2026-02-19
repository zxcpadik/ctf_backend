import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getSessionRepository, getUserRepository } from '../services/database.service';
import Environment from '../config/environment';
import logger from '../services/logger.service';
import { Session } from '../entities/Session';
import { User } from '../entities/User';

// Extend the Request type to include session and user information
declare global {
  namespace Express {
    interface Request {
      session?: Session;
      user?: User;
      isAdmin?: boolean;
      isLeader?: boolean;
      teamId?: string;
    }
  }
}

/**
 * Interface for the JWT payload.
 */
interface JwtPayload {
  sessionId: string;
}

/**
 * Authentication middleware to verify JWT and populate req.session, req.user, and status flags.
 */
class AuthMiddleware {
  static async authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return AuthMiddleware.handleUnauthorized(res, "No or invalid authorization header.");
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, Environment.JWT_SECRET) as JwtPayload;
      const sessionRepository = getSessionRepository();

      const session = await sessionRepository.findOne({
        where: { uuid: decoded.sessionId },
        relations: ['user']
      });

      if (!session || session.expiresAt < new Date()) {
        logger.warn(`Session expired or not found for sessionId: ${decoded.sessionId}`);
        return AuthMiddleware.handleUnauthorized(res, "Session expired or invalid.");
      }

      if (session.userAgent !== req.headers['user-agent']) {
        logger.warn(`User-Agent mismatch for sessionId: ${decoded.sessionId}. Potential session hijacking.`);
        // TODO Consider destroying this session for security
        return AuthMiddleware.handleUnauthorized(res, "User-Agent mismatch.");
      }

      const user = session.user;
      if (!user) {
        logger.error(`User not found for session ID: ${session.uuid}`);
        return AuthMiddleware.handleUnauthorized(res, "Associated user not found.");
      }

      // Attach session and user details to the request
      req.session = session;
      req.user = user;
      req.isAdmin = user.isAdmin;
      req.isLeader = user.isLeader;
      req.teamId = user.teamId ?? undefined;

      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        logger.warn(`Invalid JWT token: ${error.message}`);
        return AuthMiddleware.handleUnauthorized(res, "Invalid token.");
      }
      logger.error("Authentication failed due to an unexpected error:", error);
      res.status(500).json({ message: "Internal server error during authentication." });
    }
  }

  /**
   * Middleware to ensure the authenticated user is an admin.
   */
  static ensureAdmin(req: Request, res: Response, next: NextFunction): void {
    if (!req.isAdmin) {
      return AuthMiddleware.handleForbidden(res, "Access denied. Admin privileges required.");
    }
    next();
  }

  /**
   * Middleware to ensure the authenticated user is a team leader.
   */
  static ensureLeader(req: Request, res: Response, next: NextFunction): void {
    if (!req.isLeader) {
      return AuthMiddleware.handleForbidden(res, "Access denied. Team leader privileges required.");
    }
    next();
  }

  /**
   * Middleware to ensure the user's account has been finalized (team name set for leader, username for teammate).
   */
  static ensureAccountFinalized(req: Request, res: Response, next: NextFunction): void {
    if (!req.user?.name) {
      return AuthMiddleware.handleForbidden(res, "Account not finalized. Please complete setup.");
    }
    next();
  }

  static hasTeam(req: Request, res: Response, next: NextFunction): void {
    if (!req.user?.teamId) {
      return AuthMiddleware.handleForbidden(res, "You don't have team");
    }
    next();
  }

  /**
   * Helper for unauthorized responses.
   */
  private static handleUnauthorized(res: Response, message: string): void {
    res.status(401).json({ message });
  }

  /**
   * Helper for forbidden responses.
   */
  private static handleForbidden(res: Response, message: string): void {
    res.status(403).json({ message });
  }
}

export default AuthMiddleware;