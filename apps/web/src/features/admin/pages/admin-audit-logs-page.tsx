import { Search } from "lucide-react";
import { useState } from "react";

import { PaginationControls } from "../../../components/common/pagination-controls";
import { EmptyState } from "../../../components/feedback/empty-state";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { formatDateTime } from "../../../utils/formatters";
import { AdminPageHeader, AdminQueryError } from "../components/admin-page";
import { useAdminAuditLogs } from "../hooks/use-admin";
import type { AdminAuditFilters } from "../types/admin.types";

const defaults: AdminAuditFilters = { page: 1, pageSize: 20 };

export function AdminAuditLogsPage() {
  const [filters, setFilters] = useState(defaults);
  const [search, setSearch] = useState("");
  const query = useAdminAuditLogs(filters);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        description="Review redacted security and operations events. Passwords, tokens, cookies, credentials, and request bodies are never exposed."
        eyebrow="Accountability"
        title="Audit logs"
      />
      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-5">
        <form
          className="flex gap-2 md:col-span-2"
          onSubmit={(event) => {
            event.preventDefault();
            setFilters((current) => ({
              ...current,
              page: 1,
              search: search.trim() || undefined,
            }));
          }}
        >
          <Input
            aria-label="Search audit logs"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Action, entity, actor, or target"
            value={search}
          />
          <Button aria-label="Apply audit search" size="icon" type="submit">
            <Search aria-hidden="true" className="size-4" />
          </Button>
        </form>
        <Input
          aria-label="Filter audit action"
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              page: 1,
              action: event.target.value || undefined,
            }))
          }
          placeholder="Action"
          value={filters.action ?? ""}
        />
        <Input
          aria-label="Audit created from"
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
          aria-label="Audit created to"
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
          <p className="p-8 text-center">Loading audit logs…</p>
        ) : null}
        {query.data?.auditLogs.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No audit events found" />
          </div>
        ) : null}
        {query.data?.auditLogs.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    {[
                      "Time",
                      "Action",
                      "Actor",
                      "Target",
                      "Entity",
                      "Entity ID",
                      "Safe summary",
                    ].map((label) => (
                      <th className="px-4 py-3" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {query.data.auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="whitespace-nowrap px-4 py-4">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-4 py-4 font-semibold">{log.action}</td>
                      <td className="px-4 py-4">
                        {log.actor?.email ?? "System"}
                      </td>
                      <td className="px-4 py-4">
                        {log.targetUser?.email ?? "—"}
                      </td>
                      <td className="px-4 py-4">{log.entityType}</td>
                      <td className="max-w-44 truncate px-4 py-4 font-mono text-xs">
                        {log.entityId ?? "—"}
                      </td>
                      <td className="max-w-80 px-4 py-4 text-slate-600">
                        {log.summary ?? "Safe metadata recorded."}
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
    </div>
  );
}
