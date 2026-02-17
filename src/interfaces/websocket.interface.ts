import { WebSocket } from 'ws';
import { User } from '../entities/User';

export interface AuthenticatedWebSocket extends WebSocket {
  isAlive: boolean;
  user?: User;
  isAdmin: boolean;
  teamId?: string;
  userId: string;
}

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

export interface WebSocketEvent {
  event: string;
  data: any;
  target?: 'all' | 'admins' | 'team' | 'user';
  targetId?: string; // teamId or userId for specific targeting
}

// Event types
export enum WebSocketEventType {
  // Game events
  GAME_STATE_CHANGED = 'game_state_changed',
  GAME_STARTED = 'game_started',
  GAME_STOPPED = 'game_stopped',
  GAME_RESET = 'game_reset',
  
  // Submission events
  SUBMISSION_ACCEPTED = 'submission_accepted',
  SUBMISSION_REJECTED = 'submission_rejected',
  
  // Team events
  TEAM_CREATED = 'team_created',
  TEAM_UPDATED = 'team_updated',
  TEAM_DELETED = 'team_deleted',
  TEAM_MEMBER_JOINED = 'team_member_joined',
  TEAM_MEMBER_LEFT = 'team_member_left',
  TEAM_SCORE_UPDATED = 'team_score_updated',
  
  // Task events
  TASK_CREATED = 'task_created',
  TASK_UPDATED = 'task_updated',
  TASK_DELETED = 'task_deleted',
  TASK_ACTIVATED = 'task_activated',
  TASK_DEACTIVATED = 'task_deactivated',
  TASK_DESYNC = 'task_desync',
  
  // User events
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  
  // Leaderboard events
  LEADERBOARD_UPDATED = 'leaderboard_updated',
  
  // System events
  SYSTEM_MESSAGE = 'system_message',
  ERROR = 'error'
}