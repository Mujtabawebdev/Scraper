import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { dashboardQueryKeys } from "../../dashboard/api/dashboard-query-keys";
import { leadQueryKeys } from "../../leads/api/lead-query-keys";
import { getScrapingJob } from "../api/scraping-jobs.api";
import { scrapingJobQueryKeys } from "../api/scraping-job-query-keys";
import {
  isActiveJobStatus,
  type ScrapingJobStatus,
} from "../types/scraping-job.types";

export const ACTIVE_JOB_POLL_INTERVAL_MS = 3_000;

export const useScrapingJob = (jobId: string) => {
  const queryClient = useQueryClient();
  const previousStatus = useRef<ScrapingJobStatus | undefined>(undefined);
  const query = useQuery({
    queryKey: scrapingJobQueryKeys.detail(jobId),
    queryFn: () => getScrapingJob(jobId),
    enabled: jobId.length > 0,
    refetchInterval: ({ state }) => {
      const job = state.data;
      return job && isActiveJobStatus(job.status)
        ? ACTIVE_JOB_POLL_INTERVAL_MS
        : false;
    },
  });

  useEffect(() => {
    const currentStatus = query.data?.status;
    const lastStatus = previousStatus.current;

    if (
      currentStatus &&
      lastStatus &&
      isActiveJobStatus(lastStatus) &&
      !isActiveJobStatus(currentStatus)
    ) {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: leadQueryKeys.lists() }),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.summary(),
        }),
        queryClient.invalidateQueries({
          queryKey: scrapingJobQueryKeys.lists(),
        }),
      ]);
    }

    previousStatus.current = currentStatus;
  }, [query.data?.status, queryClient]);

  return query;
};
