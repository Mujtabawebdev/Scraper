import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { listScrapingJobs } from "../api/scraping-jobs.api";
import { scrapingJobQueryKeys } from "../api/scraping-job-query-keys";
import type { ScrapingJobListFilters } from "../types/scraping-job.types";

export const useScrapingJobs = (filters: ScrapingJobListFilters) =>
  useQuery({
    queryKey: scrapingJobQueryKeys.list(filters),
    queryFn: () => listScrapingJobs(filters),
    placeholderData: keepPreviousData,
  });
