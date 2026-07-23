import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { Card } from "../../../components/ui/card";
import { EmptyState } from "../../../components/feedback/empty-state";
import { formatDateTime } from "../../../utils/formatters";
import {
  UserRoleBadge,
  UserStatusBadge,
} from "../components/admin-badges";
import { AdminPageHeader, AdminQueryError } from "../components/admin-page";
import { useAdminUser } from "../hooks/use-admin";

export function AdminUserDetailPage() {
  const { userId = "" } = useParams();
  const query = useAdminUser(userId);
  const user = query.data;

  return (
    <div className="space-y-6">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900"
        to="/admin/users"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to users
      </Link>
      <AdminPageHeader
        description="Safe account details, active-session count, operational totals, and recent audited activity."
        eyebrow="User detail"
        title={user?.fullName ?? "User account"}
      />
      {query.isError ? (
        <AdminQueryError
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.isLoading ? (
        <p className="rounded-2xl bg-white p-8 text-center">Loading user…</p>
      ) : null}
      {user ? (
        <>
          <Card className="grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">
                Email
              </p>
              <p className="mt-2 break-all font-medium">{user.email}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">
                Role
              </p>
              <div className="mt-2">
                <UserRoleBadge role={user.role} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">
                Status
              </p>
              <div className="mt-2">
                <UserStatusBadge status={user.status} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">
                Last login
              </p>
              <p className="mt-2 text-sm">{formatDateTime(user.lastLoginAt)}</p>
            </div>
          </Card>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Active sessions", user.activeSessionCount],
              ["Total jobs", user.totalJobs],
              ["Completed jobs", user.completedJobs],
              ["Failed jobs", user.failedJobs],
              ["Total leads", user.totalLeads],
            ].map(([label, value]) => (
              <Card className="p-5" key={label}>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-bold">{value}</p>
              </Card>
            ))}
          </section>
          <Card className="p-6">
            <h2 className="text-lg font-bold text-slate-950">
              Recent audit events
            </h2>
            {user.recentAuditEvents.length ? (
              <ul className="mt-4 divide-y divide-slate-100">
                {user.recentAuditEvents.map((event) => (
                  <li className="py-3" key={event.id}>
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="font-semibold">{event.action}</p>
                      <time className="text-sm text-slate-500">
                        {formatDateTime(event.createdAt)}
                      </time>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {event.summary ?? "Safe audit metadata recorded."}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                className="mt-4"
                title="No recent audit events"
              />
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
