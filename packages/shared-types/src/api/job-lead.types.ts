export const approvedScrapingSources = [
  "fixture-business-directory",
  "permitted-http-directory",
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
  source: ApprovedScrapingSource;
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
  email: string | null;
  website: string | null;
  category: string | null;
  city: string | null;
  state: string | null;
  source: string;
  createdAt: string;
};

export type LeadDetail = LeadSummary & {
  address: string | null;
  postalCode: string | null;
  country: string;
  sourceUrl: string;
  scrapingJobId: string;
  updatedAt: string;
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
