import { AppError } from "../../common/errors/app-error.js";

export type AdminErrorCode =
  | "ADMIN_ACCESS_REQUIRED"
  | "SUPER_ADMIN_ACCESS_REQUIRED"
  | "USER_NOT_FOUND"
  | "INVALID_USER_STATUS_TRANSITION"
  | "CANNOT_MODIFY_OWN_ROLE"
  | "CANNOT_MODIFY_SUPER_ADMIN"
  | "FINAL_SUPER_ADMIN_REQUIRED"
  | "ADMIN_JOB_NOT_FOUND"
  | "JOB_NOT_CANCELLABLE"
  | "SOURCE_NOT_FOUND"
  | "SOURCE_NOT_APPROVED"
  | "SOURCE_REVIEW_REQUIRED"
  | "SOURCE_BLOCKED"
  | "AUTOMATED_ACCESS_NOT_ALLOWED"
  | "SOURCE_POLICY_REQUIREMENTS_NOT_MET";

export class AdminError extends AppError {
  declare readonly code: AdminErrorCode;

  constructor(statusCode: number, code: AdminErrorCode, message: string) {
    super(statusCode, code, message);
    this.name = "AdminError";
  }
}

export const adminAccessRequiredError = (): AdminError =>
  new AdminError(403, "ADMIN_ACCESS_REQUIRED", "Administrator access is required");

export const superAdminAccessRequiredError = (): AdminError =>
  new AdminError(
    403,
    "SUPER_ADMIN_ACCESS_REQUIRED",
    "Super administrator access is required",
  );

export const adminUserNotFoundError = (): AdminError =>
  new AdminError(404, "USER_NOT_FOUND", "User was not found");

export const invalidUserStatusTransitionError = (): AdminError =>
  new AdminError(
    409,
    "INVALID_USER_STATUS_TRANSITION",
    "The requested account status transition is not allowed",
  );

export const cannotModifyOwnRoleError = (): AdminError =>
  new AdminError(
    409,
    "CANNOT_MODIFY_OWN_ROLE",
    "Administrators cannot modify their own role",
  );

export const cannotModifySuperAdminError = (): AdminError =>
  new AdminError(
    403,
    "CANNOT_MODIFY_SUPER_ADMIN",
    "This administrator cannot modify a super administrator",
  );

export const finalSuperAdminRequiredError = (): AdminError =>
  new AdminError(
    409,
    "FINAL_SUPER_ADMIN_REQUIRED",
    "At least one active super administrator must remain",
  );

export const adminJobNotFoundError = (): AdminError =>
  new AdminError(404, "ADMIN_JOB_NOT_FOUND", "Scraping job was not found");

export const adminJobNotCancellableError = (): AdminError =>
  new AdminError(
    409,
    "JOB_NOT_CANCELLABLE",
    "Scraping job cannot be cancelled in its current state",
  );

export const sourceNotFoundError = (): AdminError =>
  new AdminError(404, "SOURCE_NOT_FOUND", "Approved source was not found");

export const sourceNotApprovedError = (): AdminError =>
  new AdminError(409, "SOURCE_NOT_APPROVED", "Source has not been approved");

export const sourceReviewRequiredError = (): AdminError =>
  new AdminError(
    409,
    "SOURCE_REVIEW_REQUIRED",
    "Source requires administrator review",
  );

export const sourceBlockedError = (): AdminError =>
  new AdminError(409, "SOURCE_BLOCKED", "Source is blocked");

export const automatedAccessNotAllowedError = (): AdminError =>
  new AdminError(
    409,
    "AUTOMATED_ACCESS_NOT_ALLOWED",
    "Automated access is not allowed for this source",
  );

export const sourcePolicyRequirementsNotMetError = (): AdminError =>
  new AdminError(
    409,
    "SOURCE_POLICY_REQUIREMENTS_NOT_MET",
    "Source policy requirements must be completed before approval or enablement",
  );
