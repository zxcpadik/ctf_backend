import { getUserRepository } from './database.service';
import logger from './logger.service';
import LeaderboardService from './leaderboard.service';
import GameService from './game.service';
import Environment from '../config/environment';

class ScheduledTasksService {
  private static intervals: NodeJS.Timeout[] = [];

  static startAll(): void {
    // Take leaderboard snapshots at configured interval
    this.intervals.push(setInterval(() => {
      GameService.isGameActive().then(isActive => {
        if (isActive) {
          LeaderboardService.takeSnapshot();
        }
      });
    }, Environment.LEADERBOARD_SNAPSHOT_INTERVAL_SECONDS * 1000));

    // Check game status every 30 seconds
    this.intervals.push(setInterval(() => {
      GameService.getGameStatus().then(game => {
        if (game.status === 'in_process' && game.endTime && game.endTime < new Date()) {
          GameService.forceStopGame();
        }
      });
    }, 30 * 1000));

    logger.info("Scheduled tasks started.");
  }

  static stopAll(): void {
    this.intervals.forEach(clearInterval);
    logger.info("Scheduled tasks stopped.");
  }
}

export default ScheduledTasksService;