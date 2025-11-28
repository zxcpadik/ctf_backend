import dotenv from 'dotenv';
dotenv.config();

/**
 * Provides access to environment variables, with validation and defaults.
 */
class Environment {
  static readonly PORT: number = parseInt(process.env.PORT || '3000', 10);
  static readonly JWT_SECRET: string = process.env.JWT_SECRET || 'supersecretjwtkeythatshouldbechangedinproduction';
  static readonly ADMIN_PASSWORD_HASH: string = process.env.ADMIN_PASSWORD_HASH || ''; // Hashed admin password
  static readonly TASK_FILES_PATH: string = process.env.TASK_FILES_PATH || './tasks_data';
  static readonly AUTH_CODE_TTL_MINUTES: number = parseInt(process.env.AUTH_CODE_TTL_MINUTES || '1', 10); // TTL for one-time auth codes
  static readonly LEADER_SHARE_CODE_TTL_MINUTES: number = parseInt(process.env.LEADER_SHARE_CODE_TTL_MINUTES || '1.5', 10); // TTL for leader's share code (1.5 min)
  static readonly LEADERBOARD_SNAPSHOT_INTERVAL_SECONDS: number = parseInt(process.env.LEADERBOARD_SNAPSHOT_INTERVAL_SECONDS || '60', 10); // 1 minute

  static validate(): void {
    if (!Environment.JWT_SECRET || Environment.JWT_SECRET.length < 32) {
      console.warn("WARNING: JWT_SECRET is not set or too short (min 32 chars recommended) in .env. Using default.");
    }
    if (!Environment.ADMIN_PASSWORD_HASH) {
      console.warn("WARNING: ADMIN_PASSWORD_HASH is not set in .env. Admin login won't be possible without it.");
    }
    if (isNaN(Environment.AUTH_CODE_TTL_MINUTES) || Environment.AUTH_CODE_TTL_MINUTES <= 0) {
      console.warn("WARNING: AUTH_CODE_TTL_MINUTES is invalid. Defaulting to 1 minute.");
      (Environment.AUTH_CODE_TTL_MINUTES as number) = 1;
    }
    if (isNaN(Environment.LEADER_SHARE_CODE_TTL_MINUTES) || Environment.LEADER_SHARE_CODE_TTL_MINUTES <= 0) {
      console.warn("WARNING: LEADER_SHARE_CODE_TTL_MINUTES is invalid. Defaulting to 1.5 minutes.");
      (Environment.LEADER_SHARE_CODE_TTL_MINUTES as number) = 1.5;
    }
    if (isNaN(Environment.LEADERBOARD_SNAPSHOT_INTERVAL_SECONDS) || Environment.LEADERBOARD_SNAPSHOT_INTERVAL_SECONDS <= 0) {
      console.warn("WARNING: LEADERBOARD_SNAPSHOT_INTERVAL_SECONDS is invalid. Defaulting to 60 seconds.");
      (Environment.LEADERBOARD_SNAPSHOT_INTERVAL_SECONDS as number) = 60;
    }
  }
}

Environment.validate(); // Validate environment on load

export default Environment;