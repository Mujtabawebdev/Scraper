export type LeadVerificationStatus =
  | "UNVERIFIED"
  | "PARTIALLY_VERIFIED"
  | "VERIFIED"
  | "VERIFICATION_FAILED"
  | "CONFLICTING"
  | "STALE"
  | "NO_CONTACT_DATA";

export type LeadReviewStatus =
  | "NOT_REQUIRED"
  | "REVIEW_REQUIRED"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED";

export type LeadFreshnessStatus =
  | "FRESH"
  | "AGING"
  | "STALE"
  | "UNKNOWN";

export type DuplicateMatchLevel = "EXACT" | "HIGH" | "MEDIUM" | "LOW";

export type DuplicateCandidateStatus =
  | "PENDING"
  | "CONFIRMED_DUPLICATE"
  | "NOT_DUPLICATE"
  | "IGNORED";

export type QualityIssueSeverity = "INFO" | "WARNING" | "HIGH" | "CRITICAL";

export type QualityIssueType =
  | "PHONE_MISSING"
  | "PHONE_INVALID"
  | "PHONE_PLACEHOLDER"
  | "PHONE_CONFLICT"
  | "EMAIL_INVALID"
  | "EMAIL_DISPOSABLE"
  | "EMAIL_DOMAIN_MISMATCH"
  | "WEBSITE_INVALID"
  | "WEBSITE_UNAVAILABLE"
  | "WEBSITE_DOMAIN_CONFLICT"
  | "ADDRESS_INCOMPLETE"
  | "ADDRESS_CONFLICT"
  | "BUSINESS_NAME_CONFLICT"
  | "DUPLICATE_CANDIDATE"
  | "STALE_DATA"
  | "SOURCE_BLOCKED"
  | "SOURCE_REVIEW_REQUIRED"
  | "LOW_CONFIDENCE"
  | "LOW_COMPLETENESS";

export type LeadQualityScore = {
  score: number;
  tier: "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "VERY_POOR";
  breakdown: {
    hasValidPhone: number;
    hasValidEmail: number;
    hasWorkingWebsite: number;
    hasBusinessName: number;
    hasCompleteAddress: number;
    hasCityAndState: number;
    approvedSourceCount: number;
    recentVerification: number;
    noConflicts: number;
  };
  explanation: string[];
};

export type LeadCompletenessScore = {
  score: number;
  breakdown: {
    businessName: number;
    phone: number;
    email: number;
    website: number;
    category: number;
    address: number;
    city: number;
    state: number;
    postalCode: number;
    provenance: number;
  };
};

export type LeadConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";

export type QualityIssueItem = {
  id: string;
  leadId: string;
  issueType: QualityIssueType;
  severity: QualityIssueSeverity;
  fieldName: string | null;
  summary: string;
  status: "UNRESOLVED" | "RESOLVED" | "IGNORED";
  createdAt: string;
  resolvedAt: string | null;
};

export type LeadQualitySummary = {
  qualityScore: number;
  qualityTier: "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "VERY_POOR";
  completenessScore: number;
  confidenceScore: number;
  confidenceLevel: LeadConfidenceLevel;
  verificationStatus: LeadVerificationStatus;
  freshnessStatus: LeadFreshnessStatus;
  reviewStatus: LeadReviewStatus;
  lastVerifiedAt: string | null;
  nextVerificationAt: string | null;
  staleAt: string | null;
  unresolvedIssues: QualityIssueItem[];
  scoreExplanations: string[];
};

export type LeadVerificationHistoryItem = {
  id: string;
  leadId: string;
  verificationType: string;
  status: LeadVerificationStatus;
  provider: string;
  checkedAt: string;
  expiresAt: string | null;
  resultSummary: Record<string, unknown> | null;
  failureReason: string | null;
};

export type LeadDuplicateCandidateSummary = {
  id: string;
  primaryLeadId: string;
  candidateLeadId: string;
  matchScore: number;
  matchLevel: DuplicateMatchLevel;
  matchReasons: string[];
  status: DuplicateCandidateStatus;
  primaryLead: {
    id: string;
    businessName: string;
    phone: string | null;
    email: string | null;
    website: string | null;
    city: string | null;
    state: string | null;
    confidenceScore: number;
  };
  candidateLead: {
    id: string;
    businessName: string;
    phone: string | null;
    email: string | null;
    website: string | null;
    city: string | null;
    state: string | null;
    confidenceScore: number;
  };
  createdAt: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
};

export type LeadMergePreview = {
  canonicalLeadId: string;
  candidateLeadId: string;
  selectedFields: {
    businessName: { value: string; selectedFromLeadId: string; reason: string };
    phone: { value: string | null; selectedFromLeadId: string; reason: string };
    email: { value: string | null; selectedFromLeadId: string; reason: string };
    website: { value: string | null; selectedFromLeadId: string; reason: string };
    address: { value: string | null; selectedFromLeadId: string; reason: string };
    city: { value: string | null; selectedFromLeadId: string; reason: string };
    state: { value: string | null; selectedFromLeadId: string; reason: string };
    postalCode: { value: string | null; selectedFromLeadId: string; reason: string };
  };
  conflictingValues: Array<{
    fieldName: string;
    canonicalValue: string | null;
    candidateValue: string | null;
  }>;
  matchReasons: string[];
  totalProvenanceRetained: number;
  totalVerificationsRetained: number;
};

export type LeadMergeResult = {
  success: boolean;
  canonicalLeadId: string;
  mergedLeadId: string;
  mergedAt: string;
  mergeHistoryId: string;
  message: string;
};

export type UserQualityDashboardSummary = {
  totalLeads: number;
  excellentQualityLeads: number;
  goodQualityLeads: number;
  validPhoneLeads: number;
  verifiedContactLeads: number;
  staleLeads: number;
  reviewRequiredLeads: number;
  duplicateCandidatesCount: number;
  conflictingValueLeads: number;
  avgQualityScore: number;
  avgCompletenessScore: number;
  recentStaleLeads: Array<{
    id: string;
    businessName: string;
    phone: string | null;
    qualityScore: number;
    staleAt: string | null;
  }>;
  highestSeverityIssues: QualityIssueItem[];
  pendingDuplicateReviews: LeadDuplicateCandidateSummary[];
};

export type AdminQualityDashboardSummary = {
  totalActiveLeads: number;
  canonicalLeads: number;
  mergedRecords: number;
  duplicateCandidates: number;
  staleLeads: number;
  verificationFailures: number;
  highSeverityIssues: number;
  avgQualityScore: number;
  avgCompletenessScore: number;
  blockedSourceImpact: Array<{
    sourceKey: string;
    displayName: string;
    blockedReason: string | null;
    affectedLeadCount: number;
  }>;
};
