export const USER_ROLES = ["USER", "ADMIN", "SUPER_ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "SUSPENDED", "DISABLED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export type AuthUserSummary = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
};

export type User = AuthUserSummary & {
  lastLoginAt: string | null;
  updatedAt: string;
};

export type AuthUser = User | AuthUserSummary;

export type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
};

export type AuthCredentials = {
  accessToken: string;
  user?: AuthUser | null;
};

export type ApiSuccessResponse<TData> = {
  success: true;
  message: string;
  data: TData;
};

export type ApiErrorDetail = {
  code: string;
  [key: string]: unknown;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  error: ApiErrorDetail;
};

export type AuthSuccessData = {
  user: AuthUserSummary;
  accessToken: string;
  accessTokenExpiresIn: number;
};

export type AuthSuccessResponse = ApiSuccessResponse<AuthSuccessData>;

export type RefreshSuccessData = {
  accessToken: string;
  accessTokenExpiresIn: number;
};

export type RefreshSuccessResponse = ApiSuccessResponse<RefreshSuccessData>;

export type CurrentUserData = {
  user: User;
};

export type CurrentUserResponse = ApiSuccessResponse<CurrentUserData>;

export type MessageResponse = {
  success: true;
  message: string;
};
