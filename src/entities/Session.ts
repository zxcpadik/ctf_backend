import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BaseEntity, Index } from "typeorm";
import { User } from "./User";

/**
 * Manages user sessions, primarily for JWT and user agent verification.
 */
@Entity()
export class Session extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  @Index()
  uuid: string;

  @ManyToOne(() => User, user => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column()
  user_uuid: string;

  @Column()
  user_agent: string;

  @Column({ type: "text", nullable: true })
  jwt_hash: string | null;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: "datetime" })
  expires_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}