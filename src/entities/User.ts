import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn, BaseEntity } from "typeorm";
import { Team } from "./Team";
import { Session } from "./Session";
import { Submission } from "./Submission";
import UserService, { UserRemoveStrategy } from "../services/user.service";

/**
 * Represents a user in the CTF platform, which can be a team member,
 * a team leader, or an administrator.
 */
@Entity()
export class User extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  uuid: string;

  @Column({ default: false })
  is_leader: boolean;

  @Column({ default: false })
  is_admin: boolean;

  @Column({ type: "varchar", length: 255, nullable: true })
  name: string | null;

  @Column({ nullable: true, type: "text" })
  auth_code: string | null;

  @Column({ nullable: true, type: "text" })
  password_hash: string | null;

  @Column({ nullable: true, type: "text" })
  totp_secret: string | null;

  @Column({ default: false })
  totp_enabled: boolean;

  @ManyToOne(() => Team, team => team.users, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "team_uuid" })
  team: Team | null;

  @Column({ nullable: true, type: "varchar" })
  team_uuid: string | null;

  @OneToMany(() => Session, session => session.user)
  sessions: Session[];

  @OneToMany(() => Submission, submission => submission.user)
  submissions: Submission[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;


  //#region Service aliases

  public delete(strategy: UserRemoveStrategy = "ignore") {
    return UserService.delete(this.uuid, strategy);
  }

  //#endregion
}