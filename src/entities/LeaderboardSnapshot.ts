import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, BaseEntity } from "typeorm";

/**
 * Stores historical snapshots of the leaderboard at specific times.
 */
@Entity()
export class LeaderboardSnapshot extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  uuid: string;

  @Column({ type: "datetime" })
  timestamp: Date;

  @Column({ type: "json" }) // Stores an array of team data (name, score, solved_tasks, solved_tasks_uuid)
  data: string; // JSON string representation of { teams: { name: string, score: number, solved_tasks: number, solved_tasks_uuid: string[] }[] }
}