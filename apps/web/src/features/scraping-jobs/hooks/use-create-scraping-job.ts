import { useMutation, useQueryClient } from "@tanstack/react-query";

import { dashboardQueryKeys } from "../../dashboard/api/dashboard-query-keys";
import { createScrapingJob } from "../api/scraping-jobs.api";
import { scrapingJobQueryKeys } from "../api/scraping-job-query-keys";

export const useCreateScrapingJob = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createScrapingJob,
    onSuccess: async () => {
      await Promise.all([
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
