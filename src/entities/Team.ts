import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, BaseEntity } from "typeorm";
import { User } from "./User";
import { Submission } from "./Submission";
import TeamService from "../services/team.service";

/**
 * Represents a CTF team.
 */
@Entity()
export class Team extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  uuid: string;

  @Column({ unique: true })
  name: string;

  @Column({ default: 0 })
  score: number;

  @OneToMany(() => User, user => user.team)
  users: User[];

  @OneToMany(() => Submission, submission => submission.team)
  submissions: Submission[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  
  //#region Service aliases

  public delete() {
    return TeamService.delete(this);
  }

  public update_name(team_name: string) {
    return TeamService.update_name(this, team_name);
  }

  //#endregion
}