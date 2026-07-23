import type { z } from "zod";
import type { ScrapingJobQueueSource } from "@lead-saas/shared-types";

import type {
  createScrapingJobSchema,
  createTestScrapingJobSchema,
  listScrapingJobsQuerySchema,
} from "./scraping-job.schemas.js";

export type CreateScrapingJobInput = z.infer<typeof createScrapingJobSchema>;
export type CreateTestScrapingJobInput = z.infer<typeof createTestScrapingJobSchema>;
export type ListScrapingJobsQuery = z.infer<typeof listScrapingJobsQuerySchema>;

export type NewScrapingJobData = Omit<CreateScrapingJobInput, "source"> & {
  source: ScrapingJobQueueSource;
  userId: string;
  country?: string;
  state?: string;
  city?: string;
  category?: string;
  retryOfJobId?: string;
};
