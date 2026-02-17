import { EventEmitter } from 'events';
import { WebSocketEvent, WebSocketEventType } from '../interfaces/websocket.interface';
import WebSocketService from './websocket.service';
import logger from './logger.service';

/**
 * Service for emitting and handling events across the application
 * Integrates with WebSocket service for real-time broadcasting
 */
class EventEmitterService {
  private static instance: EventEmitterService;
  private eventEmitter: EventEmitter;

  private constructor() {
    this.eventEmitter = new EventEmitter();
    this.setupEventHandlers();
  }

  static getInstance(): EventEmitterService {
    if (!EventEmitterService.instance) {
      EventEmitterService.instance = new EventEmitterService();
    }
    return EventEmitterService.instance;
  }

  private setupEventHandlers(): void {
    // Auto-broadcast all emitted events to WebSocket clients
    this.eventEmitter.on('websocket_event', (event: WebSocketEvent) => {
      WebSocketService.broadcastEvent(event);
    });
  }

  /**
   * Emit a game state change event
   */
  emitGameStateChanged(game: any): void {
    const event: WebSocketEvent = {
      event: WebSocketEventType.GAME_STATE_CHANGED,
      data: { game },
      target: 'all'
    };
    this.eventEmitter.emit('websocket_event', event);
  }

  /**
   * Emit a submission result event
   */
  emitSubmissionResult(submission: any, isCorrect: boolean): void {
    const eventType = isCorrect ? WebSocketEventType.SUBMISSION_ACCEPTED : WebSocketEventType.SUBMISSION_REJECTED;
    
    const event: WebSocketEvent = {
      event: eventType,
      data: { 
        submission: this.sanitizeSubmission(submission),
        isCorrect 
      },
      target: 'team',
      targetId: submission.teamId
    };
    this.eventEmitter.emit('websocket_event', event);

    // Also notify admins
    const adminEvent: WebSocketEvent = {
      event: eventType,
      data: { submission, isCorrect },
      target: 'admins'
    };
    this.eventEmitter.emit('websocket_event', adminEvent);

    // Broadcast score update to all if correct
    if (isCorrect) {
      this.emitTeamScoreUpdated(submission.teamId);
      this.emitLeaderboardUpdated();
    }
  }

  /**
   * Emit team-related events
   */
  emitTeamCreated(team: any): void {
    const event: WebSocketEvent = {
      event: WebSocketEventType.TEAM_CREATED,
      data: { team },
      target: 'admins'
    };
    this.eventEmitter.emit('websocket_event', event);
  }

  emitTeamUpdated(team: any): void {
    const event: WebSocketEvent = {
      event: WebSocketEventType.TEAM_UPDATED,
      data: { team },
      target: 'admins'
    };
    this.eventEmitter.emit('websocket_event', event);

    // Also notify the team members
    const teamEvent: WebSocketEvent = {
      event: WebSocketEventType.TEAM_UPDATED,
      data: { team },
      target: 'team',
      targetId: team.uuid
    };
    this.eventEmitter.emit('websocket_event', teamEvent);
  }

  emitTeamMemberJoined(teamId: string, user: any): void {
    const event: WebSocketEvent = {
      event: WebSocketEventType.TEAM_MEMBER_JOINED,
      data: { teamId, user }, // TODO sanitize sensitive user field
      target: 'team',
      targetId: teamId
    };
    this.eventEmitter.emit('websocket_event', event);

    // Notify admins
    const adminEvent: WebSocketEvent = {
      event: WebSocketEventType.TEAM_MEMBER_JOINED,
      data: { teamId, user },
      target: 'admins'
    };
    this.eventEmitter.emit('websocket_event', adminEvent);
  }

  emitTeamMemberLeft(teamId: string, user: any): void {
    const event: WebSocketEvent = {
      event: WebSocketEventType.TEAM_MEMBER_LEFT,
      data: { teamId, user },
      target: 'team',
      targetId: teamId
    };
    this.eventEmitter.emit('websocket_event', event);

    // Notify admins
    const adminEvent: WebSocketEvent = {
      event: WebSocketEventType.TEAM_MEMBER_LEFT,
      data: { teamId, user },
      target: 'admins'
    };
    this.eventEmitter.emit('websocket_event', adminEvent);
  }

  emitTeamScoreUpdated(teamId: string): void {
    const event: WebSocketEvent = {
      event: WebSocketEventType.TEAM_SCORE_UPDATED,
      data: { teamId },
      target: 'all' // Everyone can see score updates
    };
    this.eventEmitter.emit('websocket_event', event);
  }

  /**
   * Emit task-related events
   */
  emitTaskCreated(task: any): void {
    const event: WebSocketEvent = {
      event: WebSocketEventType.TASK_CREATED,
      data: { task: this.sanitizeTask(task) },
      target: 'all'
    };
    this.eventEmitter.emit('websocket_event', event);
  }

  emitTaskUpdated(task: any): void {
    const event: WebSocketEvent = {
      event: WebSocketEventType.TASK_UPDATED,
      data: { task: this.sanitizeTask(task) },
      target: 'all'
    };
    this.eventEmitter.emit('websocket_event', event);
  }

  // TODO "global" event to reload tasks and task-groups at client 
  emitTaskDescync(): void {
    const event: WebSocketEvent = {
      event: WebSocketEventType.TASK_DESYNC,
      data: {},
      target: 'all'
    };
    this.eventEmitter.emit('websocket_event', event);
  }

  /**
   * Emit leaderboard updates
   */
  emitLeaderboardUpdated(): void {
    const event: WebSocketEvent = {
      event: WebSocketEventType.LEADERBOARD_UPDATED,
      data: { timestamp: Date.now() },
      target: 'all'
    };
    this.eventEmitter.emit('websocket_event', event);
  }

  emitTaskDeleted(taskUuid: string) {
    const event: WebSocketEvent = {
      event: 'task_deleted',
      data: { taskId: taskUuid },
      target: 'all'
    };
    this.eventEmitter.emit('websocket_event', event);
  }

  /**
   * Sanitize submission data for non-admin users
   */
  private sanitizeSubmission(submission: any): any {
    const sanitized = { ...submission };
    // Remove sensitive information for team members
    delete sanitized.submittedFlag;
    delete sanitized.ipAddress;
    delete sanitized.userAgent;
    return sanitized;
  }

  /**
   * Sanitize task data for non-admin users
   */
  private sanitizeTask(task: any): any {
    const sanitized = { ...task };
    // Remove flag from task data for non-admins
    if (sanitized.flag) {
      delete sanitized.flag;
    }
    return sanitized;
  }

  /**
   * Sanitize user data
   */
  private sanitizeUser(user: any): any {
    const sanitized = { ...user };
    // Remove sensitive user information
    delete sanitized.authCode;
    return sanitized;
  }

  /**
   * Generic event emitter for custom events
   */
  emitEvent(event: WebSocketEvent): void {
    this.eventEmitter.emit('websocket_event', event);
  }
}

export default EventEmitterService.getInstance();