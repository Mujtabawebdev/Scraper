import { AppError } from "../../common/errors/app-error.js";

export type LeadErrorCode =
  | "LEAD_NOT_FOUND"
  | "EXPORT_LIMIT_EXCEEDED"
  | "PHONE_INVALID"
  | "PHONE_NOT_FOUND"
  | "LEAD_PROVENANCE_NOT_FOUND";

export class LeadError extends AppError {
  declare readonly code: LeadErrorCode;

  constructor(statusCode: number, code: LeadErrorCode, message: string) {
    super(statusCode, code, message);
    this.name = "LeadError";
  }
}

export const leadNotFoundError = (): LeadError =>
  new LeadError(404, "LEAD_NOT_FOUND", "Lead was not found");

export const exportLimitExceededError = (limit: number): LeadError =>
  new LeadError(
    422,
    "EXPORT_LIMIT_EXCEEDED",
    `CSV export is limited to ${limit} matching leads; narrow the filters and try again. Asynchronous export will be added later.`,
  );

export const phoneInvalidError = (): LeadError =>
  new LeadError(
    422,
    "PHONE_INVALID",
    "The stored phone number is invalid or a reserved placeholder",
  );

export const phoneNotFoundError = (): LeadError =>
  new LeadError(422, "PHONE_NOT_FOUND", "This lead has no phone number to verify");

export const leadProvenanceNotFoundError = (): LeadError =>
  new LeadError(
    404,
    "LEAD_PROVENANCE_NOT_FOUND",
    "Lead provenance was not found",
  );
