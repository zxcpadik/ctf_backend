import { Team } from "../entities";

export interface ResponseInterface {
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}

export interface UserResponseData {
  uuid: string;
  name: string | null;
  isLeader: boolean;
  isAdmin: boolean;
  teamId: string | null;
  createdAt: Date;
  authCode: string | null;
  team: Team | null;
}

export interface ResponseInterface {
  success: boolean;
  message: string;
  data?: UserResponseData | any;
  error?: any;
}