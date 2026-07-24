import { csvImportQueue } from "./csv-import.queue.js";
import { scrapingQueue } from "./scraping.queue.js";

export type QueueHealthResult = {
  status: "healthy" | "degraded" | "unavailable";
  queues: {
    scraping: {
      active: number;
      waiting: number;
      failed: number;
      completed: number;
    };
    csvImport: {
      active: number;
      waiting: number;
      failed: number;
      completed: number;
    };
  };
};

export const checkQueueHealth = async (): Promise<QueueHealthResult> => {
  try {
    const [scrapingCounts, csvImportCounts] = await Promise.all([
      scrapingQueue.getJobCounts("active", "waiting", "failed", "completed"),
      csvImportQueue.getJobCounts("active", "waiting", "failed", "completed"),
    ]);

    return {
      status: "healthy",
      queues: {
        scraping: {
          active: scrapingCounts.active ?? 0,
          waiting: scrapingCounts.waiting ?? 0,
          failed: scrapingCounts.failed ?? 0,
          completed: scrapingCounts.completed ?? 0,
        },
        csvImport: {
          active: csvImportCounts.active ?? 0,
          waiting: csvImportCounts.waiting ?? 0,
          failed: csvImportCounts.failed ?? 0,
          completed: csvImportCounts.completed ?? 0,
        },
      },
    };
  } catch {
    return {
      status: "unavailable",
      queues: {
        scraping: { active: 0, waiting: 0, failed: 0, completed: 0 },
        csvImport: { active: 0, waiting: 0, failed: 0, completed: 0 },
      },
    };
  }
};
