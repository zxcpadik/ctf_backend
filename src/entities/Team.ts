import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, BaseEntity } from "typeorm";
import { User } from "./User";
import { Submission } from "./Submission";

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
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}