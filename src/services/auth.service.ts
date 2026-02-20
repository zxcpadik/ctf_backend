import { compare, hash } from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getSessionRepository, getUserRepository } from './database.service';
import logger from './logger.service';
import Environment from '../config/environment';
import { User } from '../entities/User';
import { Session } from '../entities/Session';
import ValidationUtil from '../utils/validation.util';

/**
 * Service for handling user authentication, session management, and JWT generation.
 */
class AuthService {
  private static readonly JWT_EXPIRATION_SECONDS = 3600 * 24 * 7; // 7 days

  /**
   * Generates a new JWT for a given session.
   * @param {Session} session - The session for which to generate the token.
   * @returns {string} The generated JWT.
   */
  static generateJwt(session: Session): string {
    const payload = {
      sessionId: session.uuid,
    };
    return jwt.sign(payload, Environment.JWT_SECRET, { expiresIn: AuthService.JWT_EXPIRATION_SECONDS });
  }

  /**
   * Hashes a password using bcrypt.
   * @param {string} password - The plain-text password.
   * @returns {Promise<string>} The hashed password.
   */
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return hash(password, saltRounds);
  }

  /**
   * Compares a plain-text password with a hashed password.
   * @param {string} password - The plain-text password.
   * @param {string} hashedPassword - The hashed password.
   * @returns {Promise<boolean>} True if they match, false otherwise.
   */
  static async comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
    return compare(password, hashedPassword);
  }

  /**
   * Authenticates an admin user using a provided password.
   * This endpoint is special: first call checks if password is needed, second call provides password.
   * @param {string | undefined} password - The password provided by the client.
   * @param {string} userAgent - The User-Agent string from the request.
   * @returns {Promise<{ jwt?: string, passwordNeeded?: boolean, message: string, user?: User, is_password_correct?: boolean }>} Auth result.
   */
  static async admin_auth(password: string | undefined, userAgent: string): Promise<{ jwt?: string, passwordNeeded?: boolean, message: string, user?: User, is_password_correct?: boolean }> {
    try {
      if (!Environment.ADMIN_PASSWORD_HASH) {
        return { message: "Admin password not configured on server.", passwordNeeded: false };
      }

      if (!password) {
        return { message: "Admin password is required." };
      }

      const isPasswordCorrect = await AuthService.comparePasswords(password, Environment.ADMIN_PASSWORD_HASH);
      if (!isPasswordCorrect) {
        return { message: "Incorrect admin password.", is_password_correct: false };
      }

      const userRepository = getUserRepository();
      let adminUser = await userRepository.findOne({ where: { isAdmin: true } });

      if (!adminUser) {
        // Create admin user if it doesn't exist
        adminUser = userRepository.create({
          isAdmin: true,
          isLeader: false,
          name: "root"
        });
        await userRepository.save(adminUser);
        logger.info("Admin user created successfully.");
      }

      // Create and store a new session for the admin
      const sessionRepository = getSessionRepository();
      const newSession = sessionRepository.create({
        user: adminUser,
        userId: adminUser.uuid,
        userAgent: userAgent,
        expiresAt: new Date(Date.now() + AuthService.JWT_EXPIRATION_SECONDS * 1000),
      });
      await sessionRepository.save(newSession);

      const token = AuthService.generateJwt(newSession);
      newSession.jwtHash = await AuthService.hashPassword(token); // Store hash of JWT
      await sessionRepository.save(newSession);

      logger.info(`Admin user ${adminUser.uuid} authenticated successfully.`);
      return { jwt: token, message: "Admin authenticated successfully.", user: adminUser };
    } catch (error) {
      logger.error("Admin authentication error:", error);
      throw new Error("Failed to authenticate admin.");
    }
  }

  static async generateTeamLeaderAuthCode(): Promise<{ authCode: string }> {
    try {
      const authCode = Math.floor(10000000 + Math.random() * 90000000).toString(); // 8 random digits

      const userRepository = getUserRepository();
      const user = userRepository.create({
        isLeader: true,
        isAdmin: false,
        authCode: authCode
      });
      await userRepository.save(user);

      logger.info(`Team leader auth code ${authCode} generated. User UUID: ${user.uuid}`);
      return { authCode };
    } catch (error) {
      logger.error("Failed to generate team leader auth code:", error);
      throw new Error("Failed to generate team leader auth code.");
    }
  }

  /**
   * Completes the user authentication process using a one-time auth code.
   * @param {string} authCode - The 8-digit auth code.
   * @param {string} userAgent - The User-Agent string from the request.
   * @returns {Promise<{ jwt: string, user: User, message: string }>} The JWT and user object.
   */
  static async user_auth(authCode: string, userAgent: string): Promise<{ jwt: string, user: User, message: string }> {
    try {
      authCode = authCode.replaceAll(' ', ''); // TODO move validation to controller
      if (!ValidationUtil.isNonEmptyString(authCode) || authCode.length !== 8 || !/^\d+$/.test(authCode)) {
        throw new Error("Invalid authentication code format.");
      }

      const userRepository = getUserRepository();
      const user = await userRepository.findOne({
        where: { authCode: authCode },
        relations: ['team']
      });

      if (!user) {
        throw new Error("Authentication code not found.");
      }

      // Create a new session for the user
      const sessionRepository = getSessionRepository();
      const newSession = sessionRepository.create({
        user: user,
        userId: user.uuid,
        userAgent: userAgent,
        expiresAt: new Date(Date.now() + AuthService.JWT_EXPIRATION_SECONDS * 1000),
      });
      await sessionRepository.save(newSession);

      const token = AuthService.generateJwt(newSession);
      newSession.jwtHash = await AuthService.hashPassword(token);
      await sessionRepository.save(newSession);

      logger.info(`User ${user.uuid} authenticated successfully with auth code.`);

      let message = "Authentication successful.";
      if (user.isLeader && !user.name) {
        message = "Authentication successful. Please set your name and then your team name to complete your account.";
      }

      return { jwt: token, user, message };
    } catch (error) {
      logger.error("Failed to complete user authentication:", error);
      throw error;
    }
  }

  /**
   * Logs out a user by invalidating their current session.
   * @param {string} sessionId - The UUID of the session to invalidate.
   */
  static async logout(sessionId: string): Promise<void> {
    try {
      const sessionRepository = getSessionRepository();
      const session = await sessionRepository.findOne({ where: { uuid: sessionId } });

      if (session) {
        await sessionRepository.remove(session);
        logger.info(`Session ${sessionId} successfully logged out.`);
      } else {
        logger.warn(`Attempted to logout non-existent session: ${sessionId}`);
      }
    } catch (error) {
      logger.error(`Failed to logout session ${sessionId}:`, error);
      throw new Error("Failed to logout.");
    }
  }

  /**
   * Generates a unique share code for a team leader to invite teammates.
   * This code is tied to the team leader's user ID and is persistent until game reset.
   * @param {User} leader - The team leader user object.
   * @returns {Promise<string>} The generated share code.
   */
  static async requestShareCode(leader: User): Promise<string> {
    try {
      if (!leader.isLeader || !leader.name || !leader.teamId) {
        throw new Error("Only registered team leaders can request share codes.");
      }

      const userRepository = getUserRepository();
      
      // Generate a new 8-digit share code
      leader.authCode = Math.floor(10000000 + Math.random() * 90000000).toString();
      await userRepository.save(leader);

      logger.info(`Share code generated for leader ${leader.uuid}: ${leader.authCode}`);
      return leader.authCode;
    } catch (error) {
      logger.error(`Failed to request share code for leader ${leader.uuid}:`, error);
      throw error;
    }
  }
}

export default AuthService;