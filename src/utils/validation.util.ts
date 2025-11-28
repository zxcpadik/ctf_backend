/**
 * Utility class for common validation functions.
 * Follows the `utils` pattern from the provided manual.
 */
class ValidationUtil {
  /**
   * Validates if a string is a valid UUID.
   * @param {string} uuid - The string to validate.
   * @returns {boolean} True if the string is a valid UUID, false otherwise.
   */
  static isValidUuid(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Validates if a string is a non-empty string.
   * @param {string} value - The string to validate.
   * @returns {boolean} True if the string is non-empty, false otherwise.
   */
  static isNonEmptyString(value: string | undefined | null): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }

  /**
   * Validates if a value is a positive integer.
   * @param {number} value - The number to validate.
   * @returns {boolean} True if the value is a positive integer, false otherwise.
   */
  static isPositiveInteger(value: number | undefined | null): boolean {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
  }

  /**
   * Validates if a value is a non-negative integer.
   * @param {number} value - The number to validate.
   * @returns {boolean} True if the value is a non-negative integer, false otherwise.
   */
  static isNonNegativeInteger(value: number | undefined | null): boolean {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
  }
}

export default ValidationUtil;