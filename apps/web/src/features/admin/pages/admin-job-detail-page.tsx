import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { Card } from "../../../components/ui/card";
import { formatDateTime } from "../../../utils/formatters";
import { AdminPageHeader, AdminQueryError } from "../components/admin-page";
import { useAdminJob } from "../hooks/use-admin";

export function AdminJobDetailPage() {
  const { jobId = "" } = useParams();
  const query = useAdminJob(jobId);
  const job = query.data;

  return (
    <div className="space-y-6">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700"
        to="/admin/jobs"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to jobs
      </Link>
      <AdminPageHeader
        description="Authoritative job state, owner, progress, safe failure summary, statistics, and retry history."
        eyebrow="Job detail"
        title={job?.searchQuery ?? "Scraping job"}
      />
      {query.isError ? (
        <AdminQueryError
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.isLoading ? <Card className="p-8">Loading job…</Card> : null}
      {job ? (
        <>
          <Card className="grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Owner", `${job.owner.fullName} (${job.owner.email})`],
              ["Status", job.status],
              ["Source", job.source],
              ["Location", job.location],
              ["Created", formatDateTime(job.createdAt)],
              ["Started", formatDateTime(job.startedAt)],
              ["Completed", formatDateTime(job.completedAt)],
              ["Updated", formatDateTime(job.updatedAt)],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs font-semibold uppercase text-slate-500">
                  {label}
                </p>
                <p className="mt-2 break-words text-sm font-medium">{value}</p>
              </div>
            ))}
          </Card>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Progress", `${job.progressPercentage}%`],
              ["Processed", job.processedCount],
              ["Successful", job.successCount],
              ["Failed", job.failureCount],
              ["Generated leads", job.leadCount],
            ].map(([label, value]) => (
              <Card className="p-5" key={label}>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-bold">{value}</p>
              </Card>
            ))}
          </section>
          {job.errorMessage ? (
            <Card className="border-red-200 p-6">
              <h2 className="font-bold text-red-900">Safe failure summary</h2>
              <p className="mt-2 text-sm text-red-800">{job.errorMessage}</p>
            </Card>
          ) : null}
          <Card className="p-6">
            <h2 className="font-bold">Retry history</h2>
            <p className="mt-2 text-sm text-slate-600">
              {job.retries.length
                ? job.retries
                    .map(
                      (retry) =>
                        `${retry.status} — ${formatDateTime(retry.createdAt)}`,
                    )
                    .join(" · ")
                : "No retry jobs recorded."}
            </p>
          </Card>
        </>
      ) : null}
    </div>
  );
}
