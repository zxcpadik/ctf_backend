import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BaseEntity } from "typeorm";
import { Task } from "./Task";

/**
 * Represents a file associated with a CTF task.
 * Stored locally with UUID as filename, original name and mime type in DB.
 */
@Entity()
export class File extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  uuid: string;

  @Column()
  original_name: string;

  @Column()
  byte_size: number;

  @Column()
  mime_type: string;

  @Column()
  path: string;

  @ManyToOne(() => Task, task => task.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: "taskId" })
  task: Task;

  @Column()
  task_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}