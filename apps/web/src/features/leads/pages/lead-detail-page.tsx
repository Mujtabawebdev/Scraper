import {
  ArrowLeft,
  BriefcaseBusiness,
  ExternalLink,
  Globe2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { toast } from "sonner";

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
import { useLeadProvenance } from "../hooks/use-lead-provenance";
import { useVerifyLead } from "../hooks/use-verify-lead";

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
  const provenanceQuery = useLeadProvenance(leadId);
  const verifyMutation = useVerifyLead(leadId);

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
                ["Phone status", lead.phoneValidationStatus.replaceAll("_", " ")],
                [
                  "Confidence",
                  `${lead.confidenceScore}/100 · ${lead.confidenceLevel.replaceAll("_", " ")}`,
                ],
                ["Phone type", lead.phoneType.replaceAll("_", " ")],
                ["Last verified", formatDateTime(lead.lastVerifiedAt)],
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
          <Card>
            <CardHeader>
              <CardTitle>Local phone check</CardTitle>
              <CardDescription>
                Validates format and plausibility only; it does not confirm a
                carrier subscriber or current ownership.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                disabled={!lead.phone}
                isLoading={verifyMutation.isPending}
                onClick={() =>
                  verifyMutation.mutate(undefined, {
                    onSuccess: () =>
                      toast.success("Phone plausibility check completed."),
                    onError: (error) =>
                      toast.error(getApiErrorMessage(error)),
                  })
                }
                type="button"
                variant="outline"
              >
                <ShieldCheck aria-hidden="true" className="size-4" />
                Verify phone locally
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Source provenance</CardTitle>
          <CardDescription>
            Safe source history and confidence contribution. Raw provider
            payloads, credentials and headers are never displayed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {provenanceQuery.isLoading ? (
            <p className="text-sm text-slate-500">Loading provenance…</p>
          ) : null}
          {provenanceQuery.isError ? (
            <Alert variant="warning">
              {getApiErrorMessage(provenanceQuery.error)}
            </Alert>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            {provenanceQuery.data?.map((record) => {
              const provenanceUrl = getSafeHttpUrl(record.sourceUrl);
              return (
                <article
                  className="rounded-xl border border-slate-200 p-4"
                  key={record.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {record.sourceName}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {record.sourceType.replaceAll("_", " ")} ·{" "}
                        {record.extractionMethod.replaceAll("_", " ")}
                      </p>
                    </div>
                    <span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-800">
                      +{record.confidenceContribution}
                    </span>
                  </div>
                  <dl className="mt-4 grid gap-2 text-sm">
                    <div>
                      <dt className="text-slate-500">Phone found</dt>
                      <dd>{record.phone ?? "No phone found"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Collected</dt>
                      <dd>{formatDateTime(record.sourceCollectedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Source confidence</dt>
                      <dd>{record.sourceConfidenceScore}/100</dd>
                    </div>
                  </dl>
                  {provenanceUrl ? (
                    <a
                      className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
                      href={provenanceUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Open source
                      <ExternalLink aria-hidden="true" className="size-3.5" />
                    </a>
                  ) : null}
                  {record.sourceKey === "google-places-api" ? (
                    <p
                      className="mt-3 text-xs text-slate-500"
                      translate="no"
                    >
                      Google Maps
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
