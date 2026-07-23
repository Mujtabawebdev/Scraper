import {
  ArrowLeft,
  BriefcaseBusiness,
  ExternalLink,
  Globe2,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";

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
import {
  formatDateTime,
  formatOptionalText,
  getSafeHttpUrl,
} from "../../../utils/formatters";
import { useLead } from "../hooks/use-lead";

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

const getSafeReturnPath = (state: unknown): string => {
  if (!isRecord(state) || typeof state.returnTo !== "string") {
    return "/dashboard/leads";
  }
  return state.returnTo.startsWith("/dashboard/leads") &&
    !state.returnTo.startsWith("//")
    ? state.returnTo
    : "/dashboard/leads";
};

export function LeadDetailPage() {
  const { leadId = "" } = useParams();
  const location = useLocation();
  const returnTo = getSafeReturnPath(location.state as unknown);
  const leadQuery = useLead(leadId);

  if (leadQuery.isLoading) {
    return <PageLoader fullScreen={false} message="Loading lead details..." />;
  }

  if (leadQuery.isError || !leadQuery.data) {
    return (
      <div className="space-y-5">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
          to={returnTo}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to lead explorer
        </Link>
        <Alert title="Could not load this lead" variant="error">
          <p>{getApiErrorMessage(leadQuery.error)}</p>
          <Button
            className="mt-3"
            onClick={() => void leadQuery.refetch()}
            size="sm"
            variant="outline"
          >
            Try again
          </Button>
        </Alert>
      </div>
    );
  }

  const lead = leadQuery.data;
  const website = getSafeHttpUrl(lead.website);
  const sourceUrl = getSafeHttpUrl(lead.sourceUrl);
  const addressParts = [
    lead.address,
    lead.city,
    lead.state,
    lead.postalCode,
    lead.country,
  ].filter((part): part is string => Boolean(part?.trim()));

  return (
    <div className="space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-2 rounded-md text-sm font-semibold text-slate-600 hover:text-slate-950"
          to={returnTo}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to lead explorer
        </Link>
        <div className="mt-5">
          <p className="text-sm font-semibold text-brand-700">Lead detail</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            {lead.businessName}
          </h1>
          <p className="mt-2 flex items-start gap-2 text-slate-600">
            <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0" />
            {addressParts.length > 0
              ? addressParts.join(", ")
              : "Address not available"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Business information</CardTitle>
            <CardDescription>
              Public business contact information collected by the selected
              permitted source.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone
                </dt>
                <dd className="mt-1.5 text-sm text-slate-900">
                  {lead.phone ? (
                    <a
                      className="inline-flex items-center gap-2 text-brand-700 hover:underline"
                      href={`tel:${lead.phone}`}
                    >
                      <Phone aria-hidden="true" className="size-4" />
                      {lead.phone}
                    </a>
                  ) : (
                    "Not available"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email
                </dt>
                <dd className="mt-1.5 text-sm text-slate-900">
                  {lead.email ? (
                    <a
                      className="inline-flex items-center gap-2 break-all text-brand-700 hover:underline"
                      href={`mailto:${lead.email}`}
                    >
                      <Mail aria-hidden="true" className="size-4 shrink-0" />
                      {lead.email}
                    </a>
                  ) : (
                    "Not available"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Website
                </dt>
                <dd className="mt-1.5 text-sm text-slate-900">
                  {website ? (
                    <a
                      className="inline-flex items-center gap-2 break-all text-brand-700 hover:underline"
                      href={website}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <Globe2 aria-hidden="true" className="size-4 shrink-0" />
                      {lead.website}
                      <ExternalLink
                        aria-hidden="true"
                        className="size-3.5 shrink-0"
                      />
                    </a>
                  ) : (
                    formatOptionalText(lead.website)
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Category
                </dt>
                <dd className="mt-1.5 text-sm text-slate-900">
                  {formatOptionalText(lead.category)}
                </dd>
              </div>
              {[
                ["Address", lead.address],
                ["City", lead.city],
                ["State", lead.state],
                ["Postal code", lead.postalCode],
                ["Country", lead.country],
                ["Collected", formatDateTime(lead.createdAt)],
                ["Updated", formatDateTime(lead.updatedAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {label}
                  </dt>
                  <dd className="mt-1.5 text-sm text-slate-900">
                    {value || "Not available"}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BriefcaseBusiness aria-hidden="true" className="size-5" />
                Collection job
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="break-all text-sm text-slate-600">{lead.scrapingJobId}</p>
              <Link
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                to={`/dashboard/jobs/${lead.scrapingJobId}`}
              >
                View related job
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Source</CardTitle>
              <CardDescription>
                {lead.source === "fixture-business-directory"
                  ? "Fixture business directory"
                  : lead.source === "permitted-http-directory"
                    ? "Approved development directory"
                    : lead.source}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sourceUrl ? (
                <a
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  href={sourceUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Open source record
                  <ExternalLink aria-hidden="true" className="size-4" />
                </a>
              ) : (
                <p className="text-sm text-slate-500">
                  No safe external source URL is available.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
