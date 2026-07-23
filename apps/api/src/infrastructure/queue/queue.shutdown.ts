import { scrapingQueue } from "./scraping.queue.js";
import { csvImportQueue } from "./csv-import.queue.js";

export const closeQueues = async (): Promise<void> => {
  await Promise.all([scrapingQueue.close(), csvImportQueue.close()]);
};
