import { DataSource } from "typeorm";
import { User } from "../entities/User";
import { Team } from "../entities/Team";
import { TaskGroup } from "../entities/TaskGroup";
import { Task } from "../entities/Task";
import { File } from "../entities/File";
import { Submission } from "../entities/Submission";
import { Session } from "../entities/Session";
import { Game } from "../entities/Game";
import { LeaderboardSnapshot } from "../entities/LeaderboardSnapshot";
import logger from "./logger.service"; // Assume logger.service.ts will be created next

export const AppDataSource = new DataSource({
  type: "sqlite",
  database: "data.db", // SQLite database file
  synchronize: true, // Automatically synchronize schema with entities (use with caution in production)
  logging: false, // Set to 'all' for detailed SQL logging
  entities: [
    User,
    Team,
    TaskGroup,
    Task,
    File,
    Submission,
    Session,
    Game,
    LeaderboardSnapshot,
  ],
  subscribers: [],
  migrations: [],
});

/**
 * Initializes the database connection.
 * Logs success or error and exits if initialization fails.
 */
export async function initializeDatabase(): Promise<void> {
  try {
    await AppDataSource.initialize();
    logger.info("Database initialized successfully.");
  } catch (error) {
    logger.error("Database initialization failed!", error);
    console.error(error);
    process.exit(1); // Exit process if DB connection fails
  }
}

// Export repository getters for convenience
export const getUserRepository = () => AppDataSource.getRepository(User);
export const getTeamRepository = () => AppDataSource.getRepository(Team);
export const getTaskGroupRepository = () => AppDataSource.getRepository(TaskGroup);
export const getTaskRepository = () => AppDataSource.getRepository(Task);
export const getFileRepository = () => AppDataSource.getRepository(File);
export const getSubmissionRepository = () => AppDataSource.getRepository(Submission);
export const getSessionRepository = () => AppDataSource.getRepository(Session);
export const getGameRepository = () => AppDataSource.getRepository(Game);
export const getLeaderboardSnapshotRepository = () => AppDataSource.getRepository(LeaderboardSnapshot);