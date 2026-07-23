export class LeadQualityError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
    public readonly code = "LEAD_QUALITY_ERROR"
  ) {
    super(message);
    this.name = "LeadQualityError";
  }
}

export class LeadNotFoundError extends LeadQualityError {
  constructor(leadId: string) {
    super(`Lead with ID '${leadId}' was not found.`, 404, "LEAD_NOT_FOUND");
  }
}

export class LeadNotOwnedError extends LeadQualityError {
  constructor() {
    super("Access denied. You do not own this lead record.", 403, "LEAD_NOT_OWNED");
  }
}

export class DuplicateCandidateNotFoundError extends LeadQualityError {
  constructor(candidateId: string) {
    super(`Duplicate candidate with ID '${candidateId}' was not found.`, 404, "DUPLICATE_CANDIDATE_NOT_FOUND");
  }
}

export class LeadsNotCompatibleForMergeError extends LeadQualityError {
  constructor(reason: string) {
    super(`Leads are not compatible for merge: ${reason}`, 400, "LEADS_NOT_COMPATIBLE_FOR_MERGE");
  }
}

export class CircularMergeNotAllowedError extends LeadQualityError {
  constructor() {
    super("Circular merge operations are not allowed.", 400, "CIRCULAR_MERGE_NOT_ALLOWED");
  }
}

export class CrossUserMergeNotAllowedError extends LeadQualityError {
  constructor() {
    super("Cross-user lead merging is not allowed.", 403, "CROSS_USER_MERGE_NOT_ALLOWED");
  }
}
