import { DataSource } from "typeorm";
import { User } from "../entities/User";
import { Team } from "../entities/Team";
import { TaskGroup } from "../entities/TaskGroup";
import { Task } from "../entities/Task";
import { File } from "../entities/File";
import { Submission } from "../entities/Submission";
import { Session } from "../entities/Session";
import logger from "./logger.service";
import { Config } from "../entities/Config";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_CONNECTION,
  synchronize: true, // Automatically synchronize schema with entities (use with caution in production)
  logging: false,
  entities: [
    User,
    Team,
    TaskGroup,
    Task,
    File,
    Submission,
    Session,
    Config,
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
    if (!process.env.DATABASE_CONNECTION) throw new Error("DATABASE_CONNECTION not set in .env");

    await AppDataSource.initialize();
    logger.info("Database initialized successfully.");
  } catch (error) {
    logger.error("Database initialization failed!", error);
    console.error(error);
    process.exit(1);
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
export const getConfigRepository = () => AppDataSource.getRepository(Config);