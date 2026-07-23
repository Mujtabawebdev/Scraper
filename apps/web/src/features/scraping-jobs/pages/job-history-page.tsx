import { Plus, RefreshCw } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { PaginationControls } from "../../../components/common/pagination-controls";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { getApiErrorMessage } from "../../../services/api-client";
import { JobEmptyState } from "../components/job-empty-state";
import { JobFilters } from "../components/job-filters";
import { JobTable } from "../components/job-table";
import { JobTableSkeleton } from "../components/job-table-skeleton";
import { useCancelScrapingJob } from "../hooks/use-cancel-scraping-job";
import { useRetryScrapingJob } from "../hooks/use-retry-scraping-job";
import { useScrapingJobs } from "../hooks/use-scraping-jobs";
import type {
  ScrapingJobListFilters,
  ScrapingJobSummary,
} from "../types/scraping-job.types";
import {
  parseJobFilters,
  serializeJobFilters,
} from "../utils/job-filter-params";

export function JobHistoryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(
    () => parseJobFilters(searchParams),
    [searchParams],
  );
  const jobsQuery = useScrapingJobs(filters);
  const cancelMutation = useCancelScrapingJob();
  const retryMutation = useRetryScrapingJob();
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);

  const updateFilters = useCallback(
    (nextFilters: ScrapingJobListFilters) => {
      setSearchParams(serializeJobFilters(nextFilters), { replace: true });
    },
    [setSearchParams],
  );

  const handleCancel = async (job: ScrapingJobSummary): Promise<void> => {
    setCancellingJobId(job.id);
    try {
      await cancelMutation.mutateAsync(job.id);
      toast.success("Cancellation requested successfully.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setCancellingJobId(null);
    }
  };

  const handleRetry = async (job: ScrapingJobSummary): Promise<void> => {
    setRetryingJobId(job.id);
    try {
      const newJob = await retryMutation.mutateAsync(job.id);
      toast.success("A new retry job was queued.");
      navigate(`/dashboard/jobs/${newJob.id}`);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setRetryingJobId(null);
    }
  };

  const jobs = jobsQuery.data?.jobs ?? [];
  const hasFilters = searchParams.size > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-700">Collection</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Scraping jobs
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Review permitted collection runs, monitor progress, and act on
            cancellable or failed jobs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            aria-label="Refresh job history"
            isLoading={jobsQuery.isFetching}
            loadingText="Refreshing"
            onClick={() => void jobsQuery.refetch()}
            variant="outline"
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Refresh
          </Button>
          <Link
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            to="/dashboard/jobs/new"
          >
            <Plus aria-hidden="true" className="size-4" />
            Create job
          </Link>
        </div>
      </div>

      <JobFilters
        disabled={jobsQuery.isFetching}
        filters={filters}
        onChange={updateFilters}
      />

      {jobsQuery.isError ? (
        <Alert title="Could not load jobs" variant="error">
          <p>{getApiErrorMessage(jobsQuery.error)}</p>
          <Button
            className="mt-3"
            onClick={() => void jobsQuery.refetch()}
            size="sm"
            variant="outline"
          >
            Try again
          </Button>
        </Alert>
      ) : null}

      {!jobsQuery.isError ? (
        <section
          aria-label="Job history"
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          {jobsQuery.isLoading ? <JobTableSkeleton /> : null}
          {!jobsQuery.isLoading && jobs.length === 0 ? (
            <div className="p-4">
              <JobEmptyState filtered={hasFilters} />
            </div>
          ) : null}
          {!jobsQuery.isLoading && jobs.length > 0 ? (
            <>
              <JobTable
                cancellingJobId={cancellingJobId}
                jobs={jobs}
                onCancel={(job) => void handleCancel(job)}
                onRetry={(job) => void handleRetry(job)}
                retryingJobId={retryingJobId}
              />
              {jobsQuery.data ? (
                <PaginationControls
                  disabled={jobsQuery.isFetching}
                  onPageChange={(page) =>
                    updateFilters({ ...filters, page })
                  }
                  pagination={jobsQuery.data.pagination}
                />
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
