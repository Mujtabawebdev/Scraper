import {
  Activity,
  Ban,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Database,
  ShieldAlert,
  UserCheck,
  Users,
} from "lucide-react";

import { Card } from "../../../components/ui/card";
import { AdminPageHeader, AdminQueryError } from "../components/admin-page";
import { useAdminSummary } from "../hooks/use-admin";

export function AdminOverviewPage() {
  const query = useAdminSummary();
  const summary = query.data;
  const cards = summary
    ? [
        ["Total users", summary.totalUsers, Users],
        ["Active users", summary.activeUsers, UserCheck],
        ["Suspended users", summary.suspendedUsers, Ban],
        ["Total jobs", summary.totalJobs, BriefcaseBusiness],
        ["Active jobs", summary.activeJobs, Activity],
        ["Failed jobs", summary.failedJobs, ShieldAlert],
        ["Total leads", summary.totalLeads, Database],
        ["Leads today", summary.leadsCreatedToday, Clock3],
        ["Approved sources", summary.approvedSources, CheckCircle2],
        ["Review required", summary.reviewRequiredSources, Clock3],
        ["Blocked sources", summary.blockedSources, Ban],
      ] as const
    : [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        description="Live operational totals across users, permitted collection jobs, leads, and governed sources."
        eyebrow="Administration"
        title="Operations overview"
      />
      {query.isError ? (
        <AdminQueryError
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div
              className="h-32 animate-pulse rounded-2xl bg-slate-200"
              key={index}
            />
          ))}
        </div>
      ) : null}
      {summary ? (
        <section
          aria-label="Admin summary"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {cards.map(([label, value, Icon]) => (
            <Card className="p-5" key={label}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{label}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-950">
                    {value.toLocaleString()}
                  </p>
                </div>
                <span className="rounded-xl bg-violet-50 p-3 text-violet-700">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
              </div>
            </Card>
          ))}
        </section>
      ) : null}
    </div>
  );
}
