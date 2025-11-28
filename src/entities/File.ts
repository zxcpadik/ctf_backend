import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BaseEntity } from "typeorm";
import { Task } from "./Task";

/**
 * Represents a file associated with a CTF task.
 * Stored locally with UUID as filename, original name and mime type in DB.
 */
@Entity()
export class File extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  uuid: string; // Used as the filename on disk

  @Column()
  originalName: string;

  @Column()
  byte_size: number;

  @Column()
  mimeType: string;

  @Column()
  path: string; // Relative path from the tasks_data directory

  @ManyToOne(() => Task, task => task.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: "taskId" })
  task: Task;

  @Column()
  taskId: string; // Foreign key to Task

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}