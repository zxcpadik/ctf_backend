import 'reflect-metadata';
import express, { Application } from 'express';
import cors from 'cors';
import { AppDataSource, initializeDatabase } from './services/database.service';
import logger from './services/logger.service';
import Environment from './config/environment';
import { router as apiRouter } from './routes';
import fs from 'fs';

class App {
  private app: Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = Environment.PORT;
    this.configureMiddleware();
    this.configureRoutes();
  }

  private configureMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());

    // Add logging for all requests (optional, can be moved to a specific middleware)
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.originalUrl} - IP: ${req.ip}`);
      next();
    });
  }

  private configureRoutes(): void {
    this.app.get('/', (req, res) => {
      res.status(200).send('CTF Backend is running!');
    });

    this.app.use('/api', apiRouter);
  }

  public async start(): Promise<void> {
    if (!fs.existsSync('./uploads')) {
      fs.mkdirSync('./uploads');
    }

    // Ensure tasks_data directory exists
    if (!fs.existsSync(Environment.TASK_FILES_PATH)) {
      fs.mkdirSync(Environment.TASK_FILES_PATH, { recursive: true });
    }

    // Initialize database
    await initializeDatabase();

    const server = this.app.listen(this.port, () => {
      logger.info(`Server is running on port ${this.port}`);
      logger.info(`Access it at: http://localhost:${this.port}`);
    });

    // Graceful shutdown
    process.on('SIGINT', this.gracefulShutdown.bind(this));
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
  }

  private async gracefulShutdown(): Promise<void> {
    logger.info('Shutting down server...');
    // Add any other cleanup logic here (e.g., close DB connections if not handled by TypeORM)
    await AppDataSource.destroy(); // Close TypeORM connection
    logger.info('Server gracefully shut down.');
    process.exit(0);
  }
}

const appInstance = new App();
appInstance.start();