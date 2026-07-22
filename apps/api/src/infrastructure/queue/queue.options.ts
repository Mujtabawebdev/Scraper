import type { JobsOptions } from "bullmq";

export const scrapingJobDefaultOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { age: 86_400, count: 500 },
  removeOnFail: { age: 604_800, count: 1_000 },
};
