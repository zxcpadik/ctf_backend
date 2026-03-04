import { compare, hash } from 'bcrypt';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import { getSessionRepository, getUserRepository } from './database.service';
import logger from './logger.service';
import { User } from '../entities/User';
import { Session } from '../entities/Session';
import ValidationUtil from '../utils/validation.util';
import MyError from '../utils/myerror.util';
import s from "http-status";
import Environment from '../config/environment';

const SALT_ROUNDS = 10;
const JWT_EXPIRATION_SECONDS = 3600 * 24 * 7; // 7 days
const AUTH_CODE_REGEX = /^\d{8}$/;

class AuthService {
  // ─── JWT & Hashing ──────────────────────────────────────────────────────────

  /**
   * Generate a JWT for a given session.
   */
  static generate_jwt(session: Session): string {
    return jwt.sign({ session_uuid: session.uuid }, Environment.JWT_SECRET, {
      expiresIn: JWT_EXPIRATION_SECONDS,
    });
  }

  static async hash_password(password: string): Promise<string> {
    return hash(password, SALT_ROUNDS);
  }

  static async compare_passwords(password: string, hashed: string): Promise<boolean> {
    return compare(password, hashed);
  }

  // ─── Session ────────────────────────────────────────────────────────────────

  /**
   * Create a new session for a user and return a signed JWT.
   */
  private static async create_session(user: User, user_agent: string): Promise<string> {
    const session_repo = getSessionRepository();

    const session = session_repo.create({
      user,
      user_uuid: user.uuid,
      user_agent,
      expires_at: new Date(Date.now() + JWT_EXPIRATION_SECONDS * 1000),
    });
    await session_repo.save(session);

    const token = AuthService.generate_jwt(session);
    session.jwt_hash = await AuthService.hash_password(token);
    await session_repo.save(session);

    return token;
  }

  // ─── Auth code helpers ───────────────────────────────────────────────────────

  private static generate_code(): string {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  }

  private static is_auth_code(identifier: string): boolean {
    return AUTH_CODE_REGEX.test(identifier.replaceAll(' ', ''));
  }

  // ─── Login ──────────────────────────────────────────────────────────────────

  /**
   * Unified login for all user types.
   *
   * Two flows:
   *  - Auth code  (8 digits): invite or share-code based, no password required.
   *  - Name + password:       standard credential login, TOTP checked if enabled.
   *
   * Returns `totp_required: true` (no JWT) when credentials are valid but TOTP
   * token was not provided and the account has TOTP enabled.
   */
  static async login(
    identifier: string,
    user_agent: string,
    password?: string,
    totp_token?: string,
  ): Promise<{ jwt?: string, user?: User, message: string, totp_required?: boolean }> {
    try {
      identifier = identifier?.trim();
      if (!ValidationUtil.isNonEmptyString(identifier)) throw new MyError("Identifier cannot be empty", { code: s.BAD_REQUEST });

      // ── Auth code flow ────────────────────────────────────────────────────
      if (AuthService.is_auth_code(identifier)) {
        const user_repo = getUserRepository();
        const user = await user_repo.findOne({
          where: { auth_code: identifier },
          relations: ['team'],
        });
        if (!user) throw new MyError("Auth code not found", { code: s.UNAUTHORIZED });

        const token = await AuthService.create_session(user, user_agent);
        logger.info(`User ${user.uuid} authenticated via auth code`);
        return { jwt: token, user, message: "Authentication successful" };
      }

      // ── Password flow ─────────────────────────────────────────────────────
      if (!ValidationUtil.isNonEmptyString(password)) throw new MyError("Password is required", { code: s.BAD_REQUEST });

      const user_repo = getUserRepository();
      const user = await user_repo.findOne({ where: { name: identifier } });
      if (!user) throw new MyError("Invalid name or password", { code: s.UNAUTHORIZED });
      if (!user.password_hash) throw new MyError("This account has no password set. Use an auth code to log in", { code: s.UNAUTHORIZED });

      const is_password_correct = await AuthService.compare_passwords(password!, user.password_hash);
      if (!is_password_correct) throw new MyError("Invalid name or password", { code: s.UNAUTHORIZED });

      // TOTP check
      if (user.totp_enabled) {
        if (!totp_token) return { message: "TOTP token required", totp_required: true };
        const is_totp_valid = AuthService._verify_totp_token(user.totp_secret!, totp_token);
        if (!is_totp_valid) throw new MyError("Invalid TOTP token", { code: s.UNAUTHORIZED });
      }

      const token = await AuthService.create_session(user, user_agent);
      logger.info(`User ${user.uuid} authenticated via password`);
      return { jwt: token, user, message: "Authentication successful" };
    } catch (error) {
      logger.error("Login error:", error);
      throw error;
    }
  }

  // ─── Logout ─────────────────────────────────────────────────────────────────

  /**
   * Invalidate a session by UUID.
   */
  static async logout(session_uuid: string): Promise<void> {
    try {
      if (!ValidationUtil.isValidUuid(session_uuid)) throw new MyError("Invalid session UUID", { code: s.BAD_REQUEST });

      const session_repo = getSessionRepository();
      const session = await session_repo.findOne({ where: { uuid: session_uuid } });
      if (!session) throw new MyError("Session not found", { code: s.NOT_FOUND });

      await session_repo.remove(session);
      logger.info(`Session ${session_uuid} logged out`);
    } catch (error) {
      logger.error(`Failed to logout session ${session_uuid}:`, error);
      throw error;
    }
  }

  // ─── Password ────────────────────────────────────────────────────────────────

  /**
   * Set a password on a user that currently has none.
   */
  static async set_password(user_uuid: string | User, password: string): Promise<void> {
    try {
      if (typeof user_uuid == "string" && !ValidationUtil.isValidUuid(user_uuid)) throw new MyError("Invalid user UUID", { code: s.BAD_REQUEST });

      const user_repo = getUserRepository();
      const user = typeof user_uuid == "string" ? (await user_repo.findOne({ where: { uuid: user_uuid } })) : user_uuid;
      if (!user) throw new MyError("User not found", { code: s.NOT_FOUND });
      if (user.password_hash) throw new MyError("Password already set. Use change_password instead", { code: s.CONFLICT });

      AuthService._validate_password_strength(password);

      user.password_hash = await AuthService.hash_password(password);
      await user_repo.save(user);
      logger.info(`Password set for user ${user.uuid}`);
    } catch (error) {
      logger.error(`Failed to set password for user ${typeof user_uuid == "string" ? user_uuid : user_uuid?.uuid}:`, error);
      throw error;
    }
  }

  /**
   * Change an existing password after verifying the old one.
   */
  static async change_password(user_uuid: string | User, old_password: string, new_password: string): Promise<void> {
    try {
      if (typeof user_uuid == "string" && !ValidationUtil.isValidUuid(user_uuid)) throw new MyError("Invalid user UUID", { code: s.BAD_REQUEST });

      const user_repo = getUserRepository();
      const user = typeof user_uuid == "string" ? (await user_repo.findOne({ where: { uuid: user_uuid } })) : user_uuid;
      if (!user) throw new MyError("User not found", { code: s.NOT_FOUND });
      if (!user.password_hash) throw new MyError("No password set on this account", { code: s.BAD_REQUEST });

      const is_correct = await AuthService.compare_passwords(old_password, user.password_hash);
      if (!is_correct) throw new MyError("Incorrect current password", { code: s.UNAUTHORIZED });

      AuthService._validate_password_strength(new_password);
      if (old_password === new_password) throw new MyError("New password must differ from the current password", { code: s.UNPROCESSABLE_ENTITY });

      user.password_hash = await AuthService.hash_password(new_password);
      await user_repo.save(user);
      logger.info(`Password changed for user ${user.uuid}`);
    } catch (error) {
      logger.error(`Failed to change password for user ${typeof user_uuid == "string" ? user_uuid : user_uuid?.uuid}:`, error);
      throw error;
    }
  }

  // ─── TOTP ────────────────────────────────────────────────────────────────────

  /**
   * Generate a new TOTP secret for a user.
   * Does NOT enable TOTP yet — the user must confirm with totp_verify first.
   * Returns the secret and an otpauth URL for QR code generation.
   */
  static async totp_create(user_uuid: string | User): Promise<{ secret: string, otpauth_url: string }> {
    try {
      if (typeof user_uuid == "string" && !ValidationUtil.isValidUuid(user_uuid)) throw new MyError("Invalid user UUID", { code: s.BAD_REQUEST });

      const user_repo = getUserRepository();
      const user = typeof user_uuid == "string" ? (await user_repo.findOne({ where: { uuid: user_uuid } })) : user_uuid;
      if (!user) throw new MyError("User not found", { code: s.NOT_FOUND });
      if (user.totp_enabled) throw new MyError("TOTP is already enabled. Disable it first", { code: s.CONFLICT });

      const secret = speakeasy.generateSecret({
        name: `CTF:${user.name ?? user.uuid}`,
        length: 20,
      });

      // Store the secret but don't enable TOTP until verified
      user.totp_secret = secret.base32;
      await user_repo.save(user);

      logger.info(`TOTP secret generated for user ${user.uuid}`);
      return {
        secret: secret.base32,
        otpauth_url: secret.otpauth_url!,
      };
    } catch (error) {
      logger.error(`Failed to create TOTP for user ${typeof user_uuid == "string" ? user_uuid : user_uuid?.uuid}:`, error);
      throw error;
    }
  }

  /**
   * Confirm and activate TOTP for a user by verifying the first token.
   * Must be called after totp_create.
   */
  static async totp_verify(user_uuid: string | User, token: string): Promise<void> {
    try {
      if (typeof user_uuid == "string" && !ValidationUtil.isValidUuid(user_uuid)) throw new MyError("Invalid user UUID", { code: s.BAD_REQUEST });

      const user_repo = getUserRepository();
      const user = typeof user_uuid == "string" ? (await user_repo.findOne({ where: { uuid: user_uuid } })) : user_uuid;
      if (!user) throw new MyError("User not found", { code: s.NOT_FOUND });
      if (!user.totp_secret) throw new MyError("No TOTP secret found. Call totp_create first", { code: s.BAD_REQUEST });
      if (user.totp_enabled) throw new MyError("TOTP is already enabled", { code: s.CONFLICT });

      const is_valid = AuthService._verify_totp_token(user.totp_secret, token);
      if (!is_valid) throw new MyError("Invalid TOTP token", { code: s.UNAUTHORIZED });

      user.totp_enabled = true;
      await user_repo.save(user);
      logger.info(`TOTP enabled for user ${user.uuid}`);
    } catch (error) {
      logger.error(`Failed to verify TOTP for user ${typeof user_uuid == "string" ? user_uuid : user_uuid?.uuid}:`, error);
      throw error;
    }
  }

  /**
   * Disable TOTP for a user after verifying a valid token.
   */
  static async totp_disable(user_uuid: string | User, token: string): Promise<void> {
    try {
      if (typeof user_uuid == "string" && !ValidationUtil.isValidUuid(user_uuid)) throw new MyError("Invalid user UUID", { code: s.BAD_REQUEST });

      const user_repo = getUserRepository();
      const user = typeof user_uuid == "string" ? (await user_repo.findOne({ where: { uuid: user_uuid } })) : user_uuid;
      if (!user) throw new MyError("User not found", { code: s.NOT_FOUND });
      if (!user.totp_enabled) throw new MyError("TOTP is not enabled", { code: s.BAD_REQUEST });

      const is_valid = AuthService._verify_totp_token(user.totp_secret!, token);
      if (!is_valid) throw new MyError("Invalid TOTP token", { code: s.UNAUTHORIZED });

      user.totp_secret = null;
      user.totp_enabled = false;
      await user_repo.save(user);
      logger.info(`TOTP disabled for user ${user.uuid}`);
    } catch (error) {
      logger.error(`Failed to disable TOTP for user ${typeof user_uuid == "string" ? user_uuid : user_uuid?.uuid}:`, error);
      throw error;
    }
  }

  // ─── Auth code management ────────────────────────────────────────────────────

  /**
   * Generate a new invite auth code and a pending team leader user.
   */
  static async generate_auth_code(): Promise<{ auth_code: string }> {
    try {
      const auth_code = AuthService.generate_code();
      const user_repo = getUserRepository();

      const user = user_repo.create({ is_leader: true, is_admin: false, auth_code });
      await user_repo.save(user);

      logger.info(`Team leader auth code generated. User UUID: ${user.uuid}`);
      return { auth_code };
    } catch (error) {
      logger.error("Failed to generate team leader auth code:", error);
      throw error;
    }
  }

  /**
   * Regenerate the share/invite code for a team leader.
   * All eligibility checks (is_leader, name, team_uuid) are handled by middleware.
   */
  static async generate_share_code(leader: User): Promise<string> {
    try {
      const user_repo = getUserRepository();
      leader.auth_code = AuthService.generate_code();
      await user_repo.save(leader);

      logger.info(`Share code regenerated for leader ${leader.uuid}`);
      return leader.auth_code;
    } catch (error) {
      logger.error(`Failed to generate share code for leader ${leader.uuid}:`, error);
      throw error;
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private static _verify_totp_token(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1, // Allow 1 step drift (~30s)
    });
  }

  private static _validate_password_strength(password: string): void {
    if (!ValidationUtil.isNonEmptyString(password)) throw new MyError("Password cannot be empty", { code: s.UNPROCESSABLE_ENTITY });
    if (password.length < 8) throw new MyError("Password must be at least 8 characters long", { code: s.LENGTH_REQUIRED });
    if (password.length > 128) throw new MyError("Password cannot exceed 128 characters", { code: s.REQUEST_ENTITY_TOO_LARGE });
  }
}

export { AuthService };
export default AuthService;