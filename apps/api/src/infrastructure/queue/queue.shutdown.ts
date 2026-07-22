import { scrapingQueue } from "./scraping.queue.js";

export const closeQueues = async (): Promise<void> => {
  await scrapingQueue.close();
};
