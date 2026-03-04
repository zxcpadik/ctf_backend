import { Request, Response } from 'express';
import ConfigService from '../services/config.service';
import logger from '../services/logger.service';
import MyError from '../utils/myerror.util';
import s from "http-status";

class ConfigController {
  /**
   * GET /configs
   * All config entries with their current values and metadata.
   */
  static async get_all(req: Request, res: Response): Promise<void> {
    try {
      const configs = await ConfigService.get_all();
      res.status(s.OK).json({ success: true, data: configs });
    } catch (error: any) {
      logger.error("Get all configs error:", error);
      res.status(s.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /configs/:config_uuid
   * Single config entry by UUID, includes resolved options if options_resolver is set.
   */
  static async get(req: Request, res: Response): Promise<void> {
    try {
      const config = await ConfigService.get(req.params.config_uuid as string);
      if (!config) { res.status(s.NOT_FOUND).json({ success: false, message: "Config not found" }); return; }

      const options = await config.options();
      res.status(s.OK).json({ success: true, data: { ...config, options } });
    } catch (error: any) {
      logger.error("Get config error:", error);
      res.status(error instanceof MyError ? (error.code || 500) : s.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /configs
   * Create a new config entry.
   */
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const { name, type, value, default_value, description, validator, options_resolver } = req.body;
      const config = await ConfigService.create(name, type, { value, default_value, description, validator, options_resolver });
      res.status(s.CREATED).json({ success: true, data: config });
    } catch (error: any) {
      logger.error("Create config error:", error);
      res.status(error instanceof MyError ? (error.code || 500) : s.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }

  /**
   * PATCH /configs/:config_uuid/value
   * Set the value of a config entry by UUID.
   * Runs the config's validator before saving.
   */
  static async set_value(req: Request, res: Response): Promise<void> {
    try {
      const config = await ConfigService.set_value_uuid(req.params.config_uuid as string, req.body.value ?? null);
      res.status(s.OK).json({ success: true, data: config });
    } catch (error: any) {
      logger.error("Set config value error:", error);
      res.status(error instanceof MyError ? (error.code || 500) : s.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }

  /**
   * PUT /configs/:config_uuid
   * Update config metadata (name, type, default_value, description, validator, options_resolver).
   * Does not touch value — use PATCH /value for that.
   */
  static async update(req: Request, res: Response): Promise<void> {
    try {
      const { name, type, default_value, description, validator, options_resolver } = req.body;
      const config = await ConfigService.update(req.params.config_uuid as string, { name, type, default_value, description, validator, options_resolver });
      res.status(s.OK).json({ success: true, data: config });
    } catch (error: any) {
      logger.error("Update config error:", error);
      res.status(error instanceof MyError ? (error.code || 500) : s.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }

  /**
   * DELETE /configs/:config_uuid
   * Delete a config entry.
   */
  static async delete(req: Request, res: Response): Promise<void> {
    try {
      await ConfigService.delete(req.params.config_uuid as string);
      res.status(s.OK).json({ success: true, message: "Config deleted successfully" });
    } catch (error: any) {
      logger.error("Delete config error:", error);
      res.status(error instanceof MyError ? (error.code || 500) : s.BAD_REQUEST).json({ success: false, message: error.message });
    }
  }
}

export { ConfigController };
export default ConfigController;