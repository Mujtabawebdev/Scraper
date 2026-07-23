import { QueryClient } from "@tanstack/react-query";

import { ApiClientError } from "../services/api-client";

const shouldRetry = (failureCount: number, error: unknown): boolean => {
  if (error instanceof ApiClientError) {
    if (
      error.status === 401 ||
      error.status === 403 ||
      error.status === 409 ||
      error.status === 429
    ) {
      return false;
    }
    return failureCount < 1 && (error.status === null || error.status >= 500);
  }
  return failureCount < 1;
};

export const createAppQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: shouldRetry,
      },
      mutations: {
        retry: false,
      },
    },
  });

export const queryClient = createAppQueryClient();
