import { AppError } from "../../common/errors/app-error.js";

export const csvImportInvalidError = (
  message = "CSV import is invalid",
): AppError => new AppError(400, "CSV_IMPORT_INVALID", message);

export const csvImportLimitExceededError = (): AppError =>
  new AppError(
    413,
    "CSV_IMPORT_LIMIT_EXCEEDED",
    "CSV file or row count exceeds the configured limit",
  );

export const csvImportNotFoundError = (): AppError =>
  new AppError(404, "CSV_IMPORT_NOT_FOUND", "CSV import was not found");

export const csvImportQueueUnavailableError = (): AppError =>
  new AppError(
    503,
    "QUEUE_UNAVAILABLE",
    "CSV import could not be queued; please try again later",
  );
