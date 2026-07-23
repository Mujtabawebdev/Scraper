import {
  ArrowLeft,
  Ban,
  CalendarClock,
  ExternalLink,
  MapPin,
  RotateCcw,
  Search,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { PageLoader } from "../../../components/feedback/page-loader";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { getApiErrorMessage } from "../../../services/api-client";
import { formatDateTime } from "../../../utils/formatters";
import { JobProgressBar } from "../components/job-progress-bar";
import { JobStatisticsCards } from "../components/job-statistics-cards";
import { JobStatusBadge } from "../components/job-status-badge";
import { useCancelScrapingJob } from "../hooks/use-cancel-scraping-job";
import { useRetryScrapingJob } from "../hooks/use-retry-scraping-job";
import { useScrapingJob } from "../hooks/use-scraping-job";

const timeFields = [
  ["Created", "createdAt"],
  ["Started", "startedAt"],
  ["Completed", "completedAt"],
  ["Failed", "failedAt"],
  ["Cancelled", "cancelledAt"],
] as const;

export function JobDetailPage() {
  const { jobId = "" } = useParams();
  const navigate = useNavigate();
  const jobQuery = useScrapingJob(jobId);
  const cancelMutation = useCancelScrapingJob();
  const retryMutation = useRetryScrapingJob();

  if (jobQuery.isLoading) {
    return <PageLoader fullScreen={false} message="Loading job details..." />;
  }

  if (jobQuery.isError || !jobQuery.data) {
    return (
      <div className="space-y-5">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
          to="/dashboard/jobs"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to job history
        </Link>
        <Alert title="Could not load this job" variant="error">
          <p>{getApiErrorMessage(jobQuery.error)}</p>
          <Button
            className="mt-3"
            onClick={() => void jobQuery.refetch()}
            size="sm"
            variant="outline"
          >
            Try again
          </Button>
        </Alert>
      </div>
    );
  }

  const job = jobQuery.data;
  const handleCancel = async (): Promise<void> => {
    try {
      await cancelMutation.mutateAsync(job.id);
      toast.success("Cancellation requested successfully.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error));
    }
  };
  const handleRetry = async (): Promise<void> => {
    try {
      const retriedJob = await retryMutation.mutateAsync(job.id);
      toast.success("A new retry job was queued.");
      navigate(`/dashboard/jobs/${retriedJob.id}`);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error));
    }
  };
  const relatedLeadParams = new URLSearchParams({ jobId: job.id });

  return (
    <div className="space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-2 rounded-md text-sm font-semibold text-slate-600 hover:text-slate-950"
          to="/dashboard/jobs"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to job history
        </Link>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold text-brand-700">Job detail</p>
              <JobStatusBadge status={job.status} />
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              {job.searchQuery}
            </h1>
            <p className="mt-2 flex items-center gap-2 text-slate-600">
              <MapPin aria-hidden="true" className="size-4" />
              {job.location}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {job.canCancel ? (
              <Button
                isLoading={cancelMutation.isPending}
                loadingText="Cancelling"
                onClick={() => void handleCancel()}
                variant="danger"
              >
                <Ban aria-hidden="true" className="size-4" />
                Cancel job
              </Button>
            ) : null}
            {job.canRetry ? (
              <Button
                isLoading={retryMutation.isPending}
                loadingText="Retrying"
                onClick={() => void handleRetry()}
                variant="outline"
              >
                <RotateCcw aria-hidden="true" className="size-4" />
                Retry job
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {job.errorMessage ? (
        <Alert title="Job failure summary" variant="error">
          {job.errorMessage}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Collection progress</CardTitle>
          <CardDescription>
            Active jobs refresh automatically every few seconds. Polling stops
            when the job reaches a terminal status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JobProgressBar
            label={`Progress for ${job.searchQuery}`}
            progress={job.progressPercentage}
          />
          <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Source
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {job.source === "fixture-business-directory"
                    ? "Fixture business directory"
                    : "Approved development directory"}
                </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Requested limit
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {job.requestedLimit.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Leads generated
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {job.leadCount.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <JobStatisticsCards job={job} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock aria-hidden="true" className="size-5" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-slate-100">
              {timeFields.map(([label, field]) => (
                <div
                  className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  key={field}
                >
                  <dt className="text-sm text-slate-600">{label}</dt>
                  <dd className="text-right text-sm font-medium text-slate-900">
                    {formatDateTime(job[field])}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search aria-hidden="true" className="size-5" />
              Related leads
            </CardTitle>
            <CardDescription>
              Explore only the leads collected for this job.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-950">
              {job.leadCount.toLocaleString()}
            </p>
            <Link
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
              to={`/dashboard/leads?${relatedLeadParams.toString()}`}
            >
              View related leads
              <ExternalLink aria-hidden="true" className="size-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
