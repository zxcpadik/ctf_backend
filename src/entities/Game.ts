import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, BaseEntity } from "typeorm";

export enum GameStatus {
  WAITING_FOR_START = "waiting_for_start",
  IN_PROCESS = "in_process",
  TIME_ENDED = "time_ended",
  FORCE_STOPPED = "force_stopped",
}

/**
 * Represents the global state of the CTF game. There should only be one instance of this entity.
 */
@Entity()
export class Game extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  uuid: string; // Only one instance, but having a UUID is good practice

  @Column({ type: "text", default: GameStatus.WAITING_FOR_START })
  status: GameStatus;

  @Column({ type: "datetime", nullable: true })
  startTime: Date | null;

  @Column({ type: "datetime", nullable: true })
  endTime: Date | null;

  @Column({ type: "int", nullable: true }) // Duration in minutes
  playDuration: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Static method to get the single Game instance, creating it if it doesn't exist.
   * @returns {Promise<Game>} The single Game instance.
   */
  static async getGame(): Promise<Game> {
    let game = (await this.find())[0];
    if (!game) {
      game = this.create();
      await game.save();
    }
    return game;
  }
}