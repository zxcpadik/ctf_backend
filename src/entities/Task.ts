import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, BaseEntity } from "typeorm";
import { TaskGroup } from "./TaskGroup";
import { File } from "./File";
import { Submission } from "./Submission";

/**
 * Represents a single CTF task.
 */
@Entity()
export class Task extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  uuid: string;

  @Column({ unique: true })
  shortName: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column()
  score: number;

  @Column()
  flag: string; // The correct flag to solve the task

  @Column({ default: false })
  isActive: boolean; // Controls visibility and solvability for players

  @ManyToOne(() => TaskGroup, taskGroup => taskGroup.tasks, {
    onDelete: 'SET NULL',
    nullable: true
  })
  @JoinColumn({ name: "groupId" })
  group: TaskGroup | null;

  @Column({ nullable: true })
  groupId: string | null; // Foreign key to TaskGroup

  @OneToMany(() => File, file => file.task, { cascade: true })
  files: File[]; // Files associated with the task

  @OneToMany(() => Submission, submission => submission.task)
  submissions: Submission[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}