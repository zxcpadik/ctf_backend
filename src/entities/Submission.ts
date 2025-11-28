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
  @JoinColumn({ name: "userId" })
  user: User;

  @Column()
  userId: string; // Foreign key to User

  @ManyToOne(() => Task, task => task.submissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: "taskId" })
  task: Task;

  @Column()
  taskId: string; // Foreign key to Task

  @ManyToOne(() => Team, team => team.submissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: "teamId" })
  team: Team;

  @Column()
  teamId: string; // Foreign key to Team (redundant but useful for direct lookups)

  @Column({ type: "text" })
  submittedFlag: string;

  @Column()
  isCorrect: boolean;

  @Column()
  ipAddress: string;

  @Column()
  userAgent: string;

  @CreateDateColumn()
  timestamp: Date;
}