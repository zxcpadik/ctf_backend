import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BaseEntity } from "typeorm";
import { User } from "./User";

/**
 * Manages user sessions, primarily for JWT and user agent verification.
 */
@Entity()
export class Session extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  uuid: string; // Used as the sessionId in JWT payload

  @ManyToOne(() => User, user => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column()
  userId: string; // Foreign key to User

  @Column()
  userAgent: string;

  @Column({ type: "text", nullable: true })
  jwtHash: string | null; // Hash of the JWT for revocation purposes, not the token itself

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: "datetime" })
  expiresAt: Date; // Session expiration time

  @UpdateDateColumn()
  updatedAt: Date;
}