import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, BaseEntity, Index } from "typeorm";

import AuthService from "../services/auth.service";
import SubmissionService from "../services/submission.service";
import logger from "../services/logger.service";
import TaskGroupService from "../services/task-group.service";
import TaskService from "../services/task.service";
import TeamService from "../services/team.service";
import UserService from "../services/user.service";
import ConfigService from "../services/config.service";

export enum ConfigType {
  STRING = "string",
  NUMBER = "number",
  MULTIPLE = "multiple",
  BOOLEAN = "boolean",
  LIST = "list"
}

@Entity()
export class Config extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  @Index()
  uuid: string;

  @Column({ type: "varchar", length: 254 })
  name: string;

  @Column({ type: "enum", enum: ConfigType })
  type: ConfigType;

  @Column({ type: "text", nullable: true })
  value: string | null;

  @Column({ type: "text", nullable: true })
  default_value: string | null;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ type: "text", nullable: true })
  validator: string | null;

  @Column({ type: "text", nullable: true })
  options_resolver: string | null;


  @UpdateDateColumn()
  updated_at: Date;


  public async validate(val: string | null = this.value) {
    if (!val || !this.validator) return true;
    
    try {
      return await eval(this.validator)(val);
    } catch (err) { return false; }
  }

  public async options() {
    if (!this.options_resolver) return [];
    
    try {
      const $ = {
        AuthService,
        SubmissionService,
        logger,
        ConfigService,
        TaskGroupService,
        TaskService,
        TeamService,
        UserService
      }
      return await eval(this.options_resolver)($);
    } catch (err) { return []; }
  }
}