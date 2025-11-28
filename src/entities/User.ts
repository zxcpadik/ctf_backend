import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn, BaseEntity } from "typeorm";
import { Team } from "./Team";
import { Session } from "./Session";
import { Submission } from "./Submission";

/**
 * Represents a user in the CTF platform, which can be a team member,
 * a team leader, or an administrator.
 */
@Entity()
export class User extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  uuid: string;

  @Column({ default: false })
  isLeader: boolean;

  @Column({ default: false })
  isAdmin: boolean;

  @Column({ type: "varchar", length: 255, nullable: true })
  name: string | null;

  @Column({ nullable: true, type: 'text' })
  authCode: string | null;

  @ManyToOne(() => Team, team => team.users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: "teamId" })
  team: Team | null;

  @Column({ nullable: true, type: 'varchar' })
  teamId: string | null; // Foreign key to Team

  @OneToMany(() => Session, session => session.user)
  sessions: Session[];

  @OneToMany(() => Submission, submission => submission.user)
  submissions: Submission[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}