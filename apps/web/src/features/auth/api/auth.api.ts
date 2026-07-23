import { apiClient } from "../../../services/api-client";
import type {
  AuthSuccessData,
  AuthSuccessResponse,
  CurrentUserResponse,
  MessageResponse,
  RefreshSuccessResponse,
  User,
} from "../types/auth.types";

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = LoginRequest & {
  fullName: string;
};

export const login = async (input: LoginRequest): Promise<AuthSuccessData> => {
  const response = await apiClient.post<AuthSuccessResponse>("/auth/login", input);
  return response.data.data;
};

export const register = async (input: RegisterRequest): Promise<AuthSuccessData> => {
  const response = await apiClient.post<AuthSuccessResponse>("/auth/register", input);
  return response.data.data;
};

export const getCurrentUser = async (): Promise<User> => {
  const response = await apiClient.get<CurrentUserResponse>("/auth/me");
  return response.data.data.user;
};

export const refresh = async (): Promise<RefreshSuccessResponse["data"]> => {
  const response = await apiClient.post<RefreshSuccessResponse>("/auth/refresh", {});
  return response.data.data;
};

export const logout = async (): Promise<MessageResponse> => {
  const response = await apiClient.post<MessageResponse>("/auth/logout", {});
  return response.data;
};

export const logoutAll = async (): Promise<MessageResponse> => {
  const response = await apiClient.post<MessageResponse>("/auth/logout-all", {});
  return response.data;
};
