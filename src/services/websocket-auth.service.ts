import jwt from 'jsonwebtoken';
import { getSessionRepository, getUserRepository } from './database.service';
import Environment from '../config/environment';
import logger from './logger.service';
import { AuthenticatedWebSocket } from '../interfaces/websocket.interface';

/**
 * Service for handling WebSocket authentication
 */
class WebSocketAuthService {
  /**
   * Authenticate WebSocket connection using JWT token
   */
  static async authenticateConnection(token: string): Promise<{ user: any; isAdmin: boolean; teamId?: string } | null> {
    try {
      if (!token) {
        throw new Error('No token provided');
      }

      const decoded = jwt.verify(token, Environment.JWT_SECRET) as { sessionId: string };
      const sessionRepository = getSessionRepository();

      const session = await sessionRepository.findOne({
        where: { uuid: decoded.sessionId },
        relations: ['user']
      });

      if (!session || session.expiresAt < new Date()) {
        throw new Error('Invalid or expired session');
      }

      const user = session.user;
      if (!user) {
        throw new Error('User not found for session');
      }

      return {
        user,
        isAdmin: user.isAdmin,
        teamId: user.teamId || undefined
      };
    } catch (error) {
      logger.error('WebSocket authentication failed:', error);
      return null;
    }
  }

  /**
   * Authorize WebSocket for specific events/channels
   */
  static authorizeEvent(ws: AuthenticatedWebSocket, event: string, targetId?: string): boolean {
    // Admins can access everything
    if (ws.isAdmin) {
      return true;
    }

    // Check team-specific events
    if (targetId && event.includes('team')) {
      return ws.teamId === targetId;
    }

    // Check user-specific events
    if (targetId && event.includes('user')) {
      return ws.userId === targetId;
    }

    // Default authorization for general events
    const allowedEvents = [
      'game_state_changed',
      'game_started',
      'game_stopped',
      'game_reset',
      'task_created',
      'task_updated',
      'task_activated',
      'task_deactivated',
      'team_score_updated',
      'leaderboard_updated',
      'system_message'
    ];

    return allowedEvents.includes(event);
  }
}

export default WebSocketAuthService;