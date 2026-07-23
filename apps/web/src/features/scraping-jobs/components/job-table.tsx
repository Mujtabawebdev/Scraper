import type { ScrapingJobSummary } from "../types/scraping-job.types";
import { formatDateTime } from "../../../utils/formatters";
import { JobActionMenu } from "./job-action-menu";
import { JobProgressBar } from "./job-progress-bar";
import { JobStatusBadge } from "./job-status-badge";

export interface JobTableProps {
  cancellingJobId?: string | null;
  jobs: ScrapingJobSummary[];
  onCancel: (job: ScrapingJobSummary) => void;
  onRetry: (job: ScrapingJobSummary) => void;
  retryingJobId?: string | null;
}

export function JobTable({
  cancellingJobId = null,
  jobs,
  onCancel,
  onRetry,
  retryingJobId = null,
}: JobTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <caption className="sr-only">
          Scraping job history with progress and available actions
        </caption>
        <thead className="bg-slate-50">
          <tr>
            {[
              "Search query",
              "Location",
              "Source",
              "Status",
              "Progress",
              "Leads",
              "Created",
              "Actions",
            ].map((heading) => (
              <th
                className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                key={heading}
                scope="col"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {jobs.map((job) => (
            <tr className="align-top hover:bg-slate-50/70" key={job.id}>
              <th
                className="max-w-64 px-4 py-4 text-left text-sm font-semibold text-slate-900"
                scope="row"
              >
                <span className="line-clamp-2">{job.searchQuery}</span>
              </th>
              <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                {job.location}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                  {job.source === "fixture-business-directory"
                    ? "Fixture directory"
                    : "Approved development directory"}
                </td>
              <td className="whitespace-nowrap px-4 py-4">
                <JobStatusBadge status={job.status} />
              </td>
              <td className="px-4 py-4">
                <JobProgressBar
                  label={`Progress for ${job.searchQuery}`}
                  progress={job.progressPercentage}
                />
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-800">
                {job.successCount.toLocaleString()}
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                {formatDateTime(job.createdAt)}
              </td>
              <td className="min-w-52 px-4 py-4">
                <JobActionMenu
                  isCancelling={cancellingJobId === job.id}
                  isRetrying={retryingJobId === job.id}
                  jobId={job.id}
                  onCancel={() => onCancel(job)}
                  onRetry={() => onRetry(job)}
                  status={job.status}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
