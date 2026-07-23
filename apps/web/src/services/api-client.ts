import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

import { frontendEnvironment } from "../config/env";

export const apiErrorCodes = [
  "VALIDATION_ERROR",
  "EMAIL_ALREADY_IN_USE",
  "INVALID_CREDENTIALS",
  "ACCOUNT_SUSPENDED",
  "ACCOUNT_DISABLED",
  "AUTHENTICATION_REQUIRED",
  "INVALID_ACCESS_TOKEN",
  "INVALID_REFRESH_TOKEN",
  "REFRESH_TOKEN_REUSE_DETECTED",
  "INSUFFICIENT_PERMISSIONS",
  "RATE_LIMIT_EXCEEDED",
  "AUTH_RATE_LIMIT_EXCEEDED",
  "SCRAPING_JOB_NOT_FOUND",
  "SCRAPING_JOB_NOT_CANCELLABLE",
  "SCRAPING_JOB_NOT_RETRYABLE",
  "APPROVED_SOURCE_REQUIRED",
  "SOURCE_NOT_PERMITTED",
  "QUEUE_UNAVAILABLE",
  "LEAD_NOT_FOUND",
  "EXPORT_LIMIT_EXCEEDED",
  "NETWORK_ERROR",
  "INTERNAL_SERVER_ERROR",
] as const;

export type KnownApiErrorCode = (typeof apiErrorCodes)[number];

type ValidationIssue = {
  path?: ReadonlyArray<PropertyKey>;
  message?: string;
};

type ApiErrorEnvelope = {
  success?: false;
  message?: string;
  error?: {
    code?: string;
    issues?: ValidationIssue[];
  };
};

type RefreshResponse = {
  success: true;
  data: {
    accessToken: string;
    accessTokenExpiresIn: number;
  };
};

export class ApiClientError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly fieldErrors: Readonly<Record<string, string>>;

  constructor(
    message: string,
    options: {
      status: number | null;
      code: string;
      fieldErrors?: Readonly<Record<string, string>>;
    },
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = options.status;
    this.code = options.code;
    this.fieldErrors = options.fieldErrors ?? {};
  }
}

const fallbackErrorMessage = "Something went wrong. Please try again.";

const safeMessages: Readonly<Record<string, string>> = {
  VALIDATION_ERROR: "Please review the highlighted fields and try again.",
  EMAIL_ALREADY_IN_USE: "An account with this email address already exists.",
  INVALID_CREDENTIALS: "Invalid email or password.",
  ACCOUNT_SUSPENDED: "This account is suspended. Please contact support.",
  ACCOUNT_DISABLED: "This account is disabled. Please contact support.",
  AUTHENTICATION_REQUIRED: "Please sign in to continue.",
  INVALID_ACCESS_TOKEN: "Your session is no longer valid. Please sign in again.",
  INVALID_REFRESH_TOKEN: "Your session has expired. Please sign in again.",
  REFRESH_TOKEN_REUSE_DETECTED:
    "For your security, all sessions were signed out. Please sign in again.",
  INSUFFICIENT_PERMISSIONS: "You do not have permission to view this page.",
  RATE_LIMIT_EXCEEDED: "Too many attempts. Please wait and try again.",
  AUTH_RATE_LIMIT_EXCEEDED: "Too many attempts. Please wait and try again.",
  SCRAPING_JOB_NOT_FOUND:
    "This scraping job was not found or is no longer available.",
  SCRAPING_JOB_NOT_CANCELLABLE:
    "This job can no longer be cancelled because its state has changed.",
  SCRAPING_JOB_NOT_RETRYABLE: "Only failed jobs can be retried.",
  APPROVED_SOURCE_REQUIRED: "Select an approved scraping source.",
  SOURCE_NOT_PERMITTED:
    "This approved development source is not enabled on the server.",
  QUEUE_UNAVAILABLE:
    "The job queue is temporarily unavailable. Please try again shortly.",
  LEAD_NOT_FOUND: "This lead was not found or is no longer available.",
  EXPORT_LIMIT_EXCEEDED:
    "This export is too large. Narrow the filters and try again.",
  NETWORK_ERROR: "Unable to reach the server. Check your connection and try again.",
  INTERNAL_SERVER_ERROR: fallbackErrorMessage,
};

const readFieldErrors = (
  issues: ValidationIssue[] | undefined,
): Readonly<Record<string, string>> => {
  if (!issues) {
    return {};
  }

  const entries: Array<readonly [string, string]> = [];
  for (const issue of issues) {
    const field = issue.path?.[0];
    if ((typeof field === "string" || typeof field === "number") && issue.message) {
      entries.push([String(field), issue.message]);
    }
  }
  return Object.fromEntries(entries);
};

const normalizeApiEnvelope = (
  payload: ApiErrorEnvelope | undefined,
  status: number | null,
): ApiClientError => {
  const code =
    typeof payload?.error?.code === "string"
      ? payload.error.code
      : status === null
        ? "NETWORK_ERROR"
        : "INTERNAL_SERVER_ERROR";

  return new ApiClientError(safeMessages[code] ?? fallbackErrorMessage, {
    status,
    code,
    fieldErrors: readFieldErrors(payload?.error?.issues),
  });
};

export const normalizeApiError = (error: unknown): ApiClientError => {
  if (error instanceof ApiClientError) {
    return error;
  }

  if (axios.isAxiosError<ApiErrorEnvelope>(error)) {
    const status = error.response?.status ?? null;
    const payload = error.response?.data;
    return normalizeApiEnvelope(payload, status);
  }

  return new ApiClientError(fallbackErrorMessage, {
    status: null,
    code: "INTERNAL_SERVER_ERROR",
  });
};

export const normalizeApiErrorAsync = async (
  error: unknown,
): Promise<ApiClientError> => {
  if (
    axios.isAxiosError<Blob>(error) &&
    typeof Blob !== "undefined" &&
    error.response?.data instanceof Blob
  ) {
    try {
      const text = await error.response.data.text();
      const payload = JSON.parse(text) as ApiErrorEnvelope;
      return normalizeApiEnvelope(payload, error.response.status);
    } catch {
      return normalizeApiEnvelope(undefined, error.response.status);
    }
  }

  return normalizeApiError(error);
};

export const getApiErrorMessage = (error: unknown): string =>
  normalizeApiError(error).message;

type AuthStateBridge = {
  getAccessToken: () => string | null;
  setAccessToken: (accessToken: string) => void;
  clearAuthentication: () => void;
};

let authStateBridge: AuthStateBridge | null = null;
let activeRefresh: Promise<string> | null = null;

export const connectApiClientToAuth = (bridge: AuthStateBridge): (() => void) => {
  authStateBridge = bridge;
  return () => {
    if (authStateBridge === bridge) {
      authStateBridge = null;
    }
  };
};

const defaultHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
} as const;

export const apiClient: AxiosInstance = axios.create({
  baseURL: frontendEnvironment.VITE_API_BASE_URL,
  withCredentials: true,
  headers: defaultHeaders,
  timeout: 15_000,
});

const refreshClient = axios.create({
  baseURL: frontendEnvironment.VITE_API_BASE_URL,
  withCredentials: true,
  headers: defaultHeaders,
  timeout: 15_000,
});

apiClient.interceptors.request.use((request) => {
  const accessToken = authStateBridge?.getAccessToken();
  if (accessToken) {
    request.headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return request;
});

const pathsExcludedFromAutomaticRefresh = new Set([
  "/auth/register",
  "/auth/login",
  "/auth/refresh",
  "/auth/logout",
]);

const getRequestPath = (request: InternalAxiosRequestConfig): string => {
  try {
    return new URL(
      request.url ?? "",
      request.baseURL ?? frontendEnvironment.VITE_API_BASE_URL,
    ).pathname.replace(/^\/api\/v1/, "");
  } catch {
    return request.url ?? "";
  }
};

const canAttemptRefresh = (
  error: AxiosError,
  request: InternalAxiosRequestConfig & { _authRetry?: boolean },
): boolean =>
  error.response?.status === 401 &&
  request._authRetry !== true &&
  !pathsExcludedFromAutomaticRefresh.has(getRequestPath(request));

const requestFreshAccessToken = async (): Promise<string> => {
  try {
    const response = await refreshClient.post<RefreshResponse>("/auth/refresh", {});
    const accessToken = response.data.data.accessToken;
    authStateBridge?.setAccessToken(accessToken);
    return accessToken;
  } catch (error: unknown) {
    authStateBridge?.clearAuthentication();
    throw normalizeApiError(error);
  }
};

export const refreshAccessToken = (): Promise<string> => {
  if (!activeRefresh) {
    activeRefresh = requestFreshAccessToken().finally(() => {
      activeRefresh = null;
    });
  }
  return activeRefresh;
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error) && error.config) {
      const request = error.config as InternalAxiosRequestConfig & {
        _authRetry?: boolean;
      };
      if (canAttemptRefresh(error, request)) {
        request._authRetry = true;
        try {
          const accessToken = await refreshAccessToken();
          request.headers.set("Authorization", `Bearer ${accessToken}`);
          return await apiClient(request);
        } catch (refreshError: unknown) {
          return await Promise.reject(normalizeApiError(refreshError));
        }
      }
    }

    return await Promise.reject(await normalizeApiErrorAsync(error));
  },
);
