import { getTeamRepository } from './database.service';
import logger from './logger.service';
import { Team } from '../entities/Team';
import ValidationUtil from '../utils/validation.util';
import s from "http-status";
import MyError from '../utils/myerror.util';
import UserService from './user.service';

export type TeamRelations = 'submissions' | 'users';

class TeamService {
  /**
   * Get all teams
   */
  static async get_all(relations: TeamRelations[] = []): Promise<Team[]> {
    try {
      const team_repo = getTeamRepository();
      return await team_repo.find({
        order: { score: 'DESC', created_at: 'ASC' },
        relations: relations
      });
    } catch (error) {
      logger.error("Failed to get teams with relations:", error);
      throw error;
    }
  }

  /**
   * Get a specific team by uuid
   */
  static async get(team_uuid: string, relations: TeamRelations[] = []): Promise<Team | null> {
    try {
      if (!ValidationUtil.isValidUuid(team_uuid)) throw new MyError("Invalid team UUID", { code: s.BAD_REQUEST });

      const team_repo = getTeamRepository();
      return await team_repo.findOne({ 
        where: { uuid: team_uuid }, 
        relations: relations 
      });
    } catch (error) {
      logger.error(`Failed to get team ${team_uuid}:`, error);
      throw error;
    }
  }

  /**
   * Delete team
   */
  static async delete(team_uuid: string | Team): Promise<void> {
    try {
      if (typeof team_uuid == "string" && !ValidationUtil.isValidUuid(team_uuid)) throw new MyError("Invalid team UUID", { code: s.BAD_REQUEST });

      const team = typeof team_uuid == "string" ? (await this.get(team_uuid, ["users"])) : team_uuid;
      if (!team) throw new MyError("Team not found", { code: s.NOT_FOUND });

      for (let user of team.users) {
        await UserService.delete(user.uuid, "ignore");
      }
      
      await team.remove();
      logger.info(`Team ${team.uuid} deleted`);
    } catch (err) {
      logger.error(`Failed to delete team ${typeof team_uuid == "string" ? team_uuid : team_uuid?.uuid}:`, err);
      throw err;
    }
  }

  /**
   * Update team name
   */
  static async update_name(team_uuid: string | Team, team_name_: string): Promise<Team> {
    try {
      if (typeof team_uuid == "string" && !ValidationUtil.isValidUuid(team_uuid)) throw new MyError("Invalid team UUID", { code: s.BAD_REQUEST });

      const team_repo = getTeamRepository();
      const team = typeof team_uuid == "string" ? (await team_repo.findOne({ where: { uuid: team_uuid } })) : team_uuid;
      if (!team) throw new MyError("Team not found", { code: s.NOT_FOUND });

      const team_name = team_name_?.trim();
      if (typeof team_name !== 'string') throw new MyError("Team name type invalid", { code: s.BAD_REQUEST });
      if (!team_name) throw new MyError("Team name can not be empty", { code: s.UNPROCESSABLE_ENTITY });
      if (team_name.length < 3) throw new MyError("Team name must be at least 3 characters long", { code: s.LENGTH_REQUIRED });
      if (team_name.length > 16) throw new MyError("Team name can't be longer than 16 characters", { code: s.REQUEST_ENTITY_TOO_LARGE });

      const existing_team = await team_repo.findOne({ where: { name: team_name } });
      if (existing_team && existing_team.uuid !== team.uuid) throw new MyError("Team name already taken", { code: s.CONFLICT });

      team.name = team_name.trim();
      await team_repo.save(team);
      logger.info(`Team ${team.uuid} name updated to: ${team_name}`);
      return team;
    } catch (err) {
      logger.error(`Failed to update team name for ${typeof team_uuid == "string" ? team_uuid : team_uuid?.uuid}:`, err);
      throw err;
    }
  }
}

export { TeamService };
export default TeamService;