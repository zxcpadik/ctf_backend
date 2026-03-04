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
  short_name: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column()
  score: number;

  @Column()
  flag: string;

  @Column({ default: false })
  is_active: boolean;

  @Column({ default: false })
  is_case_sensitive: boolean;

  @ManyToOne(() => TaskGroup, taskGroup => taskGroup.tasks, {
    onDelete: 'SET NULL',
    nullable: true
  })
  @JoinColumn({ name: "group_uuid" })
  group: TaskGroup | null;

  @Column({ nullable: true })
  group_uuid: string | null;

  @OneToMany(() => File, file => file.task, { cascade: true })
  files: File[];

  @OneToMany(() => Submission, submission => submission.task)
  submissions: Submission[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

}