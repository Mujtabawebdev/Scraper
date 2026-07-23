import type { DashboardSummary } from "@lead-saas/shared-types";
import {
  Activity,
  AtSign,
  BriefcaseBusiness,
  CheckCircle2,
  CircleX,
  Phone,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useAppSelector } from "../app/store";
import { Alert } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { useDashboardSummary } from "../features/dashboard/hooks/use-dashboard-summary";
import { selectCurrentUser } from "../features/auth/store/auth.slice";
import { getApiErrorMessage } from "../services/api-client";

type SummaryMetric = {
  className: string;
  description: string;
  icon: LucideIcon;
  key: keyof DashboardSummary;
  label: string;
};

const summaryMetrics: readonly SummaryMetric[] = [
  {
    className: "bg-blue-50 text-blue-700",
    description: "All collection jobs created by your account.",
    icon: BriefcaseBusiness,
    key: "totalJobs",
    label: "Total jobs",
  },
  {
    className: "bg-amber-50 text-amber-700",
    description: "Jobs currently pending, queued, or running.",
    icon: Activity,
    key: "activeJobs",
    label: "Active jobs",
  },
  {
    className: "bg-emerald-50 text-emerald-700",
    description: "Jobs that reached successful completion.",
    icon: CheckCircle2,
    key: "completedJobs",
    label: "Completed jobs",
  },
  {
    className: "bg-red-50 text-red-700",
    description: "Jobs that ended with a safe failure state.",
    icon: CircleX,
    key: "failedJobs",
    label: "Failed jobs",
  },
  {
    className: "bg-violet-50 text-violet-700",
    description: "Business leads collected for your account.",
    icon: UsersRound,
    key: "totalLeads",
    label: "Total leads",
  },
  {
    className: "bg-cyan-50 text-cyan-700",
    description: "Collected leads that include a phone number.",
    icon: Phone,
    key: "leadsWithPhone",
    label: "Leads with phone",
  },
  {
    className: "bg-indigo-50 text-indigo-700",
    description: "Collected leads that include an email address.",
    icon: AtSign,
    key: "leadsWithEmail",
    label: "Leads with email",
  },
];

export function DashboardPage() {
  const user = useAppSelector(selectCurrentUser);
  const summaryQuery = useDashboardSummary();
  const firstName = user?.fullName.trim().split(/\s+/)[0] ?? "there";

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-700">Dashboard</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Welcome, {firstName}
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            Monitor your permitted collection jobs and user-owned business lead
            data from one secure workspace.
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          to="/dashboard/jobs/new"
        >
          Create scraping job
        </Link>
      </section>

      <section
        aria-labelledby="account-overview-heading"
        className="grid gap-4 sm:grid-cols-2"
      >
        <h2 className="sr-only" id="account-overview-heading">
          Account overview
        </h2>
        <Card>
          <CardHeader>
            <CardDescription>Current role</CardDescription>
            <CardTitle>{user?.role.replace("_", " ") ?? "USER"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Account status</CardDescription>
            <CardTitle className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full bg-emerald-500"
              />
              {user?.status ?? "ACTIVE"}
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section aria-labelledby="metrics-heading">
        <div className="mb-4">
          <h2
            className="text-xl font-semibold text-slate-950"
            id="metrics-heading"
          >
            Workspace snapshot
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Live, account-specific totals from the job and lead store.
          </p>
        </div>

        {summaryQuery.isError ? (
          <Alert className="mb-4" title="Could not load summary" variant="error">
            <p>{getApiErrorMessage(summaryQuery.error)}</p>
            <Button
              className="mt-3"
              onClick={() => void summaryQuery.refetch()}
              size="sm"
              variant="outline"
            >
              Try again
            </Button>
          </Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryMetrics.map(
            ({ className, description, icon: Icon, key, label }) => (
              <Card key={key}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-600">
                        {label}
                      </p>
                      {summaryQuery.isLoading ? (
                        <Skeleton
                          aria-label={`Loading ${label}`}
                          className="mt-2 h-9 w-20"
                        />
                      ) : (
                        <p className="mt-2 text-3xl font-bold text-slate-950">
                          {summaryQuery.data?.[key].toLocaleString() ?? "—"}
                        </p>
                      )}
                    </div>
                    <span
                      aria-hidden="true"
                      className={[
                        "flex size-10 items-center justify-center rounded-xl",
                        className,
                      ].join(" ")}
                    >
                      <Icon className="size-5" />
                    </span>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-slate-500">
                    {description}
                  </p>
                </CardContent>
              </Card>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
