import { getConfigRepository } from './database.service';
import logger from './logger.service';
import { Config, ConfigType } from '../entities/Config';
import ValidationUtil from '../utils/validation.util';
import MyError from '../utils/myerror.util';
import s from "http-status";

class ConfigService {
  /**
   * Create a new config entry.
   */
  static async create(
    name: string,
    type: ConfigType,
    options: { value?: string | null, default_value?: string | null, description?: string | null, validator?: string | null, options_resolver?: string | null } = {}
  ): Promise<Config> {
    try {
      if (!ValidationUtil.isNonEmptyString(name)) throw new MyError("Config name cannot be empty", { code: s.UNPROCESSABLE_ENTITY });
      if (!Object.values(ConfigType).includes(type)) throw new MyError("Invalid config type", { code: s.BAD_REQUEST });

      const config_repo = getConfigRepository();

      const is_name_taken = await config_repo.exists({ where: { name } });
      if (is_name_taken) throw new MyError(`Config with name '${name}' already exists`, { code: s.CONFLICT });

      const config = config_repo.create({
        name,
        type,
        value: options.value ?? null,
        default_value: options.default_value ?? null,
        description: options.description ?? null,
        validator: options.validator ?? null,
        options_resolver: options.options_resolver ?? null,
      });

      await config_repo.save(config);
      logger.info(`Config '${name}' created with UUID: ${config.uuid}`);
      return config;
    } catch (error) {
      logger.error("Failed to create config:", error);
      throw error;
    }
  }

  /**
   * Get all config entries.
   */
  static async get_all(): Promise<Config[]> {
    try {
      const config_repo = getConfigRepository();
      return await config_repo.find({ order: { name: 'ASC' } });
    } catch (error) {
      logger.error("Failed to get all configs:", error);
      throw error;
    }
  }

  /**
   * Get a specific config by UUID.
   */
  static async get(config_uuid: string): Promise<Config | null> {
    try {
      if (!ValidationUtil.isValidUuid(config_uuid)) throw new MyError("Invalid config UUID", { code: s.BAD_REQUEST });

      const config_repo = getConfigRepository();
      return await config_repo.findOne({ where: { uuid: config_uuid } });
    } catch (error) {
      logger.error(`Failed to get config ${config_uuid}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific config by name.
   */
  static async get_by_name(name: string): Promise<Config | null> {
    try {
      if (!ValidationUtil.isNonEmptyString(name)) throw new MyError("Config name cannot be empty", { code: s.UNPROCESSABLE_ENTITY });

      const config_repo = getConfigRepository();
      return await config_repo.findOne({ where: { name } });
    } catch (error) {
      logger.error(`Failed to get config by name '${name}':`, error);
      throw error;
    }
  }

  /**
   * Get the effective value of a config entry by name.
   * Falls back to default_value if value is null.
   * Returns null if the config does not exist.
   */
  static async get_value(name: string): Promise<string | null> {
    try {
      const config = await ConfigService.get_by_name(name);
      if (!config) return null;
      return config.value ?? config.default_value ?? null;
    } catch (error) {
      logger.error(`Failed to get value for config '${name}':`, error);
      throw error;
    }
  }

  /**
   * Get the effective value of a config entry by UUID or entity.
   * Falls back to default_value if value is null.
   */
  static async get_value_uuid(config_uuid: string | Config): Promise<string | null> {
    try {
      if (typeof config_uuid == "string" && !ValidationUtil.isValidUuid(config_uuid)) throw new MyError("Invalid config UUID", { code: s.BAD_REQUEST });

      const config_repo = getConfigRepository();
      const config = typeof config_uuid == "string" ? (await config_repo.findOne({ where: { uuid: config_uuid } })) : config_uuid;
      if (!config) throw new MyError("Config not found", { code: s.NOT_FOUND });

      return config.value ?? config.default_value ?? null;
    } catch (error) {
      logger.error(`Failed to get value for config ${typeof config_uuid == "string" ? config_uuid : config_uuid?.uuid}:`, error);
      throw error;
    }
  }

  /**
   * Set the value of a config entry by name.
   * Runs the config's validator before saving.
   */
  static async set_value(name: string, value: string | null): Promise<Config> {
    try {
      if (!ValidationUtil.isNonEmptyString(name)) throw new MyError("Config name cannot be empty", { code: s.UNPROCESSABLE_ENTITY });

      const config_repo = getConfigRepository();
      const config = await config_repo.findOne({ where: { name } });
      if (!config) throw new MyError(`Config '${name}' not found`, { code: s.NOT_FOUND });

      const is_valid = await config.validate(value);
      if (!is_valid) throw new MyError(`Value '${value}' failed validation for config '${config.name}'`, { code: s.UNPROCESSABLE_ENTITY });

      config.value = value;
      await config_repo.save(config);
      logger.info(`Config '${config.name}' value updated to: ${value}`);
      return config;
    } catch (error) {
      logger.error(`Failed to set value for config '${name}':`, error);
      throw error;
    }
  }

  /**
   * Set the value of a config entry by UUID or entity.
   * Runs the config's validator before saving.
   */
  static async set_value_uuid(config_uuid: string | Config, value: string | null): Promise<Config> {
    try {
      if (typeof config_uuid == "string" && !ValidationUtil.isValidUuid(config_uuid)) throw new MyError("Invalid config UUID", { code: s.BAD_REQUEST });

      const config_repo = getConfigRepository();
      const config = typeof config_uuid == "string" ? (await config_repo.findOne({ where: { uuid: config_uuid } })) : config_uuid;
      if (!config) throw new MyError("Config not found", { code: s.NOT_FOUND });

      const is_valid = await config.validate(value);
      if (!is_valid) throw new MyError(`Value '${value}' failed validation for config '${config.name}'`, { code: s.UNPROCESSABLE_ENTITY });

      config.value = value;
      await config_repo.save(config);
      logger.info(`Config '${config.name}' value updated to: ${value}`);
      return config;
    } catch (error) {
      logger.error(`Failed to set value for config ${typeof config_uuid == "string" ? config_uuid : config_uuid?.uuid}:`, error);
      throw error;
    }
  }

  /**
   * Update config metadata (everything except value).
   */
  static async update(
    config_uuid: string | Config,
    update_data: { name?: string, type?: ConfigType, default_value?: string | null, description?: string | null, validator?: string | null, options_resolver?: string | null }
  ): Promise<Config> {
    try {
      if (typeof config_uuid == "string" && !ValidationUtil.isValidUuid(config_uuid)) throw new MyError("Invalid config UUID", { code: s.BAD_REQUEST });

      const config_repo = getConfigRepository();
      const config = typeof config_uuid == "string" ? (await config_repo.findOne({ where: { uuid: config_uuid } })) : config_uuid;
      if (!config) throw new MyError("Config not found", { code: s.NOT_FOUND });

      if (update_data.name !== undefined) {
        if (!ValidationUtil.isNonEmptyString(update_data.name)) throw new MyError("Config name cannot be empty", { code: s.UNPROCESSABLE_ENTITY });
        const existing = await config_repo.findOne({ where: { name: update_data.name } });
        if (existing && existing.uuid !== config.uuid) throw new MyError(`Config with name '${update_data.name}' already exists`, { code: s.CONFLICT });
        config.name = update_data.name;
      }
      if (update_data.type !== undefined) {
        if (!Object.values(ConfigType).includes(update_data.type)) throw new MyError("Invalid config type", { code: s.BAD_REQUEST });
        config.type = update_data.type;
      }
      if (update_data.default_value !== undefined) config.default_value = update_data.default_value;
      if (update_data.description !== undefined) config.description = update_data.description;
      if (update_data.validator !== undefined) config.validator = update_data.validator;
      if (update_data.options_resolver !== undefined) config.options_resolver = update_data.options_resolver;

      await config_repo.save(config);
      logger.info(`Config '${config.name}' updated`);
      return config;
    } catch (error) {
      logger.error(`Failed to update config ${typeof config_uuid == "string" ? config_uuid : config_uuid?.uuid}:`, error);
      throw error;
    }
  }

  /**
   * Delete a config entry.
   */
  static async delete(config_uuid: string | Config): Promise<void> {
    try {
      if (typeof config_uuid == "string" && !ValidationUtil.isValidUuid(config_uuid)) throw new MyError("Invalid config UUID", { code: s.BAD_REQUEST });

      const config_repo = getConfigRepository();
      const config = typeof config_uuid == "string" ? (await config_repo.findOne({ where: { uuid: config_uuid } })) : config_uuid;
      if (!config) throw new MyError("Config not found", { code: s.NOT_FOUND });

      await config_repo.remove(config);
      logger.info(`Config '${config.name}' deleted`);
    } catch (error) {
      logger.error(`Failed to delete config ${typeof config_uuid == "string" ? config_uuid : config_uuid?.uuid}:`, error);
      throw error;
    }
  }
}

export { ConfigService };
export default ConfigService;