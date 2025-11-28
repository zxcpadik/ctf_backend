import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, BaseEntity } from "typeorm";
import { Task } from "./Task";

/**
 * Represents a group of CTF tasks.
 */
@Entity()
export class TaskGroup extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  uuid: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ default: true })
  isActive: boolean; // Add this field for batch operations

  @OneToMany(() => Task, task => task.group)
  tasks: Task[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}