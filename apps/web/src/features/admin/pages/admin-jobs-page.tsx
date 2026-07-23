import { Search, XCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { PaginationControls } from "../../../components/common/pagination-controls";
import { EmptyState } from "../../../components/feedback/empty-state";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { getApiErrorMessage } from "../../../services/api-client";
import { formatDateTime } from "../../../utils/formatters";
import { AdminDialog } from "../components/admin-dialog";
import { AdminPageHeader, AdminQueryError } from "../components/admin-page";
import { useAdminJobs, useAdminMutations } from "../hooks/use-admin";
import type {
  AdminJobFilters,
  AdminJobSummary,
} from "../types/admin.types";

const defaults: AdminJobFilters = {
  page: 1,
  pageSize: 20,
  sortBy: "createdAt",
  sortOrder: "desc",
};

export function AdminJobsPage() {
  const [filters, setFilters] = useState(defaults);
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<AdminJobSummary | null>(null);
  const [reason, setReason] = useState("");
  const query = useAdminJobs(filters);
  const { cancelJob } = useAdminMutations();

  const confirmCancel = async () => {
    if (!selected || reason.trim().length < 5) {
      toast.error("Please provide a cancellation reason.");
      return;
    }
    try {
      await cancelJob.mutateAsync({
        jobId: selected.id,
        reason: reason.trim(),
      });
      toast.success("Job cancellation recorded.");
      setSelected(null);
      setReason("");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        description="Monitor permitted collection jobs across all users and cancel only non-terminal work."
        eyebrow="Operations"
        title="Job monitoring"
      />
      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-6">
        <form
          className="flex gap-2 lg:col-span-2"
          onSubmit={(event) => {
            event.preventDefault();
            setFilters((current) => ({
              ...current,
              page: 1,
              userEmail: email.trim() || undefined,
            }));
          }}
        >
          <Input
            aria-label="Filter jobs by user email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="User email"
            type="email"
            value={email}
          />
          <Button aria-label="Apply job user filter" size="icon" type="submit">
            <Search aria-hidden="true" className="size-4" />
          </Button>
        </form>
        <Select
          aria-label="Filter jobs by status"
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              page: 1,
              status: event.target.value || undefined,
            }))
          }
          value={filters.status ?? ""}
        >
          <option value="">All statuses</option>
          {["PENDING", "QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"].map(
            (status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ),
          )}
        </Select>
        <Select
          aria-label="Filter jobs by source"
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              page: 1,
              source: event.target.value || undefined,
            }))
          }
          value={filters.source ?? ""}
        >
          <option value="">All sources</option>
          <option value="fixture-business-directory">Fixture test source</option>
          <option value="permitted-http-directory">
            Permitted HTTP directory
          </option>
        </Select>
        <Input
          aria-label="Jobs created from"
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              page: 1,
              createdFrom: event.target.value || undefined,
            }))
          }
          type="date"
          value={filters.createdFrom ?? ""}
        />
        <Input
          aria-label="Jobs created to"
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              page: 1,
              createdTo: event.target.value || undefined,
            }))
          }
          type="date"
          value={filters.createdTo ?? ""}
        />
      </section>
      {query.isError ? (
        <AdminQueryError
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {query.isLoading ? (
          <p className="p-8 text-center">Loading monitored jobs…</p>
        ) : null}
        {query.data?.jobs.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No jobs match these filters" />
          </div>
        ) : null}
        {query.data?.jobs.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    {[
                      "User",
                      "Search query",
                      "Location",
                      "Source",
                      "Status",
                      "Progress",
                      "Leads",
                      "Created",
                      "Actions",
                    ].map((label) => (
                      <th className="px-4 py-3" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {query.data.jobs.map((job) => (
                    <tr key={job.id}>
                      <td className="px-4 py-4">
                        <p className="font-semibold">{job.owner.fullName}</p>
                        <p className="text-xs text-slate-500">
                          {job.owner.email}
                        </p>
                      </td>
                      <td className="max-w-56 truncate px-4 py-4">
                        {job.searchQuery}
                      </td>
                      <td className="px-4 py-4">{job.location}</td>
                      <td className="px-4 py-4">{job.source}</td>
                      <td className="px-4 py-4 font-semibold">{job.status}</td>
                      <td className="min-w-36 px-4 py-4">
                        <div className="h-2 rounded-full bg-slate-200">
                          <div
                            className="h-2 rounded-full bg-violet-600"
                            style={{ width: `${job.progressPercentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">
                          {job.progressPercentage}%
                        </span>
                      </td>
                      <td className="px-4 py-4">{job.leadCount}</td>
                      <td className="whitespace-nowrap px-4 py-4">
                        {formatDateTime(job.createdAt)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-max gap-2">
                          <Link
                            className="inline-flex min-h-9 items-center rounded-lg border border-slate-300 px-3 font-semibold"
                            to={`/admin/jobs/${job.id}`}
                          >
                            View
                          </Link>
                          {["PENDING", "QUEUED", "RUNNING"].includes(
                            job.status,
                          ) ? (
                            <Button
                              onClick={() => setSelected(job)}
                              size="sm"
                              variant="danger"
                            >
                              <XCircle aria-hidden="true" className="size-4" />
                              Cancel
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              disabled={query.isFetching}
              onPageChange={(page) =>
                setFilters((current) => ({ ...current, page }))
              }
              pagination={query.data.pagination}
            />
          </>
        ) : null}
      </section>
      <AdminDialog
        confirmLabel="Cancel job"
        danger
        isPending={cancelJob.isPending}
        onCancel={() => setSelected(null)}
        onConfirm={() => void confirmCancel()}
        open={selected !== null}
        title="Cancel this active job?"
      >
        <p>
          Cancellation is cooperative. Leads already collected will be
          preserved and the action will be recorded with the owner and job ID.
        </p>
        <Input
          aria-label="Cancellation reason"
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason for cancellation"
          value={reason}
        />
      </AdminDialog>
    </div>
  );
}
