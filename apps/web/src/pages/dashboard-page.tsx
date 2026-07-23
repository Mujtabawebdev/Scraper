import {
  Activity,
  BriefcaseBusiness,
  CircleX,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { useAppSelector } from "../app/store";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { selectCurrentUser } from "../features/auth/store/auth.slice";

type PlaceholderMetric = {
  description: string;
  icon: LucideIcon;
  label: string;
};

const placeholderMetrics: readonly PlaceholderMetric[] = [
  {
    description: "Job analytics arrive in a later phase.",
    icon: BriefcaseBusiness,
    label: "Total jobs",
  },
  {
    description: "Lead analytics arrive in a later phase.",
    icon: UsersRound,
    label: "Collected leads",
  },
  {
    description: "Live job status arrives in a later phase.",
    icon: Activity,
    label: "Active jobs",
  },
  {
    description: "Failure analytics arrive in a later phase.",
    icon: CircleX,
    label: "Failed jobs",
  },
];

export function DashboardPage() {
  const user = useAppSelector(selectCurrentUser);
  const firstName = user?.fullName.trim().split(/\s+/)[0] ?? "there";

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold text-brand-700">Dashboard</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Welcome, {firstName}
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Your secure workspace foundation is ready. Job collection and lead
          management experiences will be connected in later phases.
        </p>
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
            These cards are placeholders; no production metrics are displayed.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {placeholderMetrics.map(({ description, icon: Icon, label }) => (
            <Card key={label}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-600">{label}</p>
                    <p
                      aria-label={`${label} unavailable until a later phase`}
                      className="mt-2 text-3xl font-bold text-slate-400"
                    >
                      &mdash;
                    </p>
                  </div>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                </div>
                <p className="mt-4 text-xs leading-5 text-slate-500">
                  {description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
