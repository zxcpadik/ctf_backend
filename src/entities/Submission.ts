import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BaseEntity } from "typeorm";
import { User } from "./User";
import { Task } from "./Task";
import { Team } from "./Team";

/**
 * Records a user's attempt to submit a flag for a task.
 * Used for scoring and admin logging.
 */
@Entity()
export class Submission extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  uuid: string;

  @ManyToOne(() => User, user => user.submissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: "user_uuid" })
  user: User;

  @Column()
  user_uuid: string;

  @ManyToOne(() => Task, task => task.submissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: "task_uuid" })
  task: Task;

  @Column()
  task_uuid: string;

  @ManyToOne(() => Team, team => team.submissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: "team_uuid" })
  team: Team;

  @Column()
  team_uuid: string;

  @CreateDateColumn()
  timestamp: Date;
}