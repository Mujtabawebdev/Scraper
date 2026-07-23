import { useMutation, useQueryClient } from "@tanstack/react-query";

import { dashboardQueryKeys } from "../../dashboard/api/dashboard-query-keys";
import { retryScrapingJob } from "../api/scraping-jobs.api";
import { scrapingJobQueryKeys } from "../api/scraping-job-query-keys";

export const useRetryScrapingJob = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: retryScrapingJob,
    onSuccess: async (_newJob, originalJobId) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: scrapingJobQueryKeys.detail(originalJobId),
        }),
        queryClient.invalidateQueries({
          queryKey: scrapingJobQueryKeys.lists(),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.summary(),
        }),
      ]);
    },
  });
};
