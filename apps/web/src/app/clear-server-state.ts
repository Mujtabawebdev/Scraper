import type { QueryClient } from "@tanstack/react-query";

/**
 * All TanStack Query data is authenticated, user-scoped server state in the
 * current application. Remove it synchronously at every authentication-clear
 * boundary so a later account cannot observe the previous tenant's cache.
 */
export const clearUserServerState = (client: QueryClient): void => {
  void client.cancelQueries();
  client.removeQueries();
};
