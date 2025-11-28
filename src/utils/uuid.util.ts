import { randomUUID } from "crypto";

/**
 * Utility for generating UUIDs.
 * While TypeORM handles primary key UUIDs, this can be used for other purposes if needed.
 */
class UUIDUtil {
  /**
   * Generates a new random UUID (version 4).
   * @returns {string} A new UUID.
   */
  static generate(): string {
    return randomUUID();
  }
}

export default UUIDUtil;