import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, BaseEntity } from "typeorm";
import { Task } from "./Task";
import TaskGroupService from "../services/task-group.service";

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
  is_active: boolean;

  @OneToMany(() => Task, task => task.group)
  tasks: Task[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;


  //#region Service alias

  public delete() {
    return TaskGroupService.delete(this);
  }

  //#endregion

}