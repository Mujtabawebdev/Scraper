import { AppError } from "../../common/errors/app-error.js";

export type ScrapingJobErrorCode =
  | "SCRAPING_JOB_NOT_FOUND"
  | "SCRAPING_JOB_NOT_CANCELLABLE"
  | "SCRAPING_JOB_NOT_RETRYABLE"
  | "APPROVED_SOURCE_REQUIRED"
  | "SOURCE_NOT_PERMITTED"
  | "QUEUE_UNAVAILABLE";

export class ScrapingJobError extends AppError {
  declare readonly code: ScrapingJobErrorCode;

  constructor(statusCode: number, code: ScrapingJobErrorCode, message: string) {
    super(statusCode, code, message);
    this.name = "ScrapingJobError";
  }
}

export const scrapingJobNotFoundError = (): ScrapingJobError =>
  new ScrapingJobError(404, "SCRAPING_JOB_NOT_FOUND", "Scraping job was not found");

export const scrapingJobNotCancellableError = (): ScrapingJobError =>
  new ScrapingJobError(
    409,
    "SCRAPING_JOB_NOT_CANCELLABLE",
    "Scraping job cannot be cancelled in its current state",
  );

export const scrapingJobNotRetryableError = (): ScrapingJobError =>
  new ScrapingJobError(
    409,
    "SCRAPING_JOB_NOT_RETRYABLE",
    "Only a failed scraping job can be retried",
  );

export const approvedSourceRequiredError = (): ScrapingJobError =>
  new ScrapingJobError(
    400,
    "APPROVED_SOURCE_REQUIRED",
    "An approved scraping source is required",
  );

export const sourceNotPermittedError = (): ScrapingJobError =>
  new ScrapingJobError(
    400,
    "SOURCE_NOT_PERMITTED",
    "Requested scraping source is not enabled",
  );

export const queueUnavailableError = (): ScrapingJobError =>
  new ScrapingJobError(
    503,
    "QUEUE_UNAVAILABLE",
    "Scraping job could not be queued; please try again later",
  );
