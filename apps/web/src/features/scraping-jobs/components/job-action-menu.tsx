import { Ban, Eye, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import {
  isActiveJobStatus,
  type ScrapingJobStatus,
} from "../types/scraping-job.types";

export interface JobActionMenuProps {
  canCancel?: boolean;
  canRetry?: boolean;
  isCancelling?: boolean;
  isRetrying?: boolean;
  jobId: string;
  onCancel: () => void;
  onRetry: () => void;
  status: ScrapingJobStatus;
}

export function JobActionMenu({
  canCancel,
  canRetry,
  isCancelling = false,
  isRetrying = false,
  jobId,
  onCancel,
  onRetry,
  status,
}: JobActionMenuProps) {
  const showCancel = canCancel ?? isActiveJobStatus(status);
  const showRetry = canRetry ?? status === "FAILED";

  return (
    <div
      aria-label="Job actions"
      className="flex flex-wrap items-center gap-2"
      role="group"
    >
      <Link
        aria-label={`View job ${jobId}`}
        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        to={`/dashboard/jobs/${jobId}`}
      >
        <Eye aria-hidden="true" className="size-3.5" />
        View
      </Link>
      {showCancel ? (
        <Button
          aria-label={`Cancel job ${jobId}`}
          isLoading={isCancelling}
          loadingText="Cancelling"
          onClick={onCancel}
          size="sm"
          variant="danger"
        >
          <Ban aria-hidden="true" className="size-3.5" />
          Cancel
        </Button>
      ) : null}
      {showRetry ? (
        <Button
          aria-label={`Retry job ${jobId}`}
          isLoading={isRetrying}
          loadingText="Retrying"
          onClick={onRetry}
          size="sm"
          variant="outline"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}
