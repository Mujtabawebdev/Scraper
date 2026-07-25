export const approvedScrapingSources = [
  "fixture-business-directory",
  "permitted-http-directory",
  "google-places-api",
  "government-dataset",
  "meta-approved-api",
  "yelp-approved-api",
] as const;

export type ApprovedScrapingSource = (typeof approvedScrapingSources)[number];

export const scrapingJobStatuses = [
  "PENDING",
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export type ScrapingJobStatus = (typeof scrapingJobStatuses)[number];

export type CreateScrapingJobRequest = {
  source?: ApprovedScrapingSource;
  searchQuery: string;
  location: string;
  requestedLimit: number;
};

export type ScrapingJobSummary = {
  id: string;
  source: ApprovedScrapingSource;
  status: ScrapingJobStatus;
  searchQuery: string;
  location: string;
  requestedLimit: number;
  processedCount: number;
  successCount: number;
  failureCount: number;
  duplicateCount: number;
  progressPercentage: number;
  pipelineStage:
    | "DISCOVER_BUSINESSES"
    | "FETCH_SOURCE_DETAILS"
    | "DISCOVER_OFFICIAL_WEBSITE"
    | "CRAWL_PUBLIC_CONTACT_PAGES"
    | "EXTRACT_CONTACT_DATA"
    | "NORMALIZE_PHONE"
    | "VALIDATE_PHONE"
    | "DEDUPLICATE"
    | "SCORE_CONFIDENCE"
    | "PERSIST_LEAD"
    | "COMPLETE_JOB";
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
};

export type ScrapingJobDetail = ScrapingJobSummary & {
  updatedAt: string;
  errorMessage: string | null;
  leadCount: number;
  canCancel: boolean;
  canRetry: boolean;
  retryOfJobId: string | null;
};

export type LeadSummary = {
  id: string;
  businessName: string;
  phone: string | null;
  normalizedPhone: string | null;
  phoneExtension: string | null;
  phoneCountryCode: string | null;
  phoneNationalFormat: string | null;
  phoneType: "LANDLINE" | "MOBILE" | "VOIP" | "TOLL_FREE" | "UNKNOWN";
  phoneValidationStatus:
    | "VALID"
    | "POSSIBLE"
    | "INVALID"
    | "PLACEHOLDER"
    | "UNVERIFIED"
    | "NO_PHONE_FOUND";
  email: string | null;
  website: string | null;
  category: string | null;
  city: string | null;
  state: string | null;
  source: string;
  sourceType: string;
  confidenceScore: number;
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";
  lastVerifiedAt: string | null;
  provenanceCount: number;
  createdAt: string;
};

export type LeadDetail = LeadSummary & {
  address: string | null;
  postalCode: string | null;
  country: string;
  sourceUrl: string;
  scrapingJobId: string;
  updatedAt: string;
  googlePlaceId: string | null;
  officialWebsiteDomain: string | null;
};

export type LeadProvenance = {
  id: string;
  sourceKey: string;
  sourceName: string;
  sourceType: string;
  sourceRecordId: string | null;
  sourceUrl: string | null;
  sourceCollectedAt: string;
  sourceLastCheckedAt: string | null;
  sourceConfidenceScore: number;
  verificationStatus: LeadSummary["phoneValidationStatus"];
  extractionMethod: string;
  phone: string | null;
  normalizedPhone: string | null;
  email: string | null;
  website: string | null;
  googlePlaceId: string | null;
  confidenceContribution: number;
};

export type AvailableSourceState =
  | "AVAILABLE"
  | "MISSING_CREDENTIALS"
  | "REVIEW_REQUIRED"
  | "DISABLED"
  | "BLOCKED"
  | "NOT_IMPLEMENTED";

export type AvailableSource = {
  key: string;
  displayName: string;
  sourceType: string;
  description: string;
  state: AvailableSourceState;
  canCreateJob: boolean;
  supportsWebsiteEnrichment: boolean;
  credentialConfigured: boolean;
};

export type CsvImportStatus =
  | "PENDING"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED";

export type CsvImportSummary = {
  id: string;
  originalFilename: string;
  sourceName: string;
  status: CsvImportStatus;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  importedRows: number;
  errors: ReadonlyArray<{ row: number; code: string; message: string }>;
  createdAt: string;
  completedAt: string | null;
};

export type PaginationMetadata = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type DashboardSummary = {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalLeads: number;
  leadsWithPhone: number;
  leadsWithEmail: number;
};
