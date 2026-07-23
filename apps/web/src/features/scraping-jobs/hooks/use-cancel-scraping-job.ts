import { useMutation, useQueryClient } from "@tanstack/react-query";

import { dashboardQueryKeys } from "../../dashboard/api/dashboard-query-keys";
import { cancelScrapingJob } from "../api/scraping-jobs.api";
import { scrapingJobQueryKeys } from "../api/scraping-job-query-keys";

export const useCancelScrapingJob = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelScrapingJob,
    onSuccess: async (job) => {
      queryClient.setQueryData(scrapingJobQueryKeys.detail(job.id), job);
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
