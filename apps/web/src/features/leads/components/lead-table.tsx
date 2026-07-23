import { ExternalLink, Eye, Mail, Phone } from "lucide-react";
import { Link } from "react-router-dom";

import { formatDateTime, getSafeHttpUrl } from "../../../utils/formatters";
import type { LeadSummary } from "../types/lead.types";

export interface LeadTableProps {
  leads: LeadSummary[];
  returnTo: string;
}

const OptionalValue = ({ value }: { value: string | null }) => (
  <span className={value ? "text-slate-700" : "text-slate-400"}>
    {value || "—"}
  </span>
);

export function LeadTable({ leads, returnTo }: LeadTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <caption className="sr-only">
          Collected business leads and contact details
        </caption>
        <thead className="bg-slate-50">
          <tr>
            {[
              "Business name",
              "Phone",
              "Phone status",
              "Confidence",
              "Email",
              "Website",
              "Category",
              "City",
              "State",
              "Source",
              "Verified",
              "Provenance",
              "Collected at",
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
          {leads.map((lead) => {
            const website = getSafeHttpUrl(lead.website);
            return (
              <tr className="align-top hover:bg-slate-50/70" key={lead.id}>
                <th
                  className="max-w-64 px-4 py-4 text-left text-sm font-semibold text-slate-900"
                  scope="row"
                >
                  <span className="line-clamp-2">{lead.businessName}</span>
                </th>
                <td className="whitespace-nowrap px-4 py-4 text-sm">
                  {lead.phone ? (
                    <a
                      className="inline-flex items-center gap-1.5 text-slate-700 hover:text-brand-700 hover:underline"
                      href={`tel:${lead.phone}`}
                    >
                      <Phone aria-hidden="true" className="size-3.5" />
                      {lead.phone}
                    </a>
                  ) : (
                    <OptionalValue value={null} />
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                    {lead.phoneValidationStatus.replaceAll("_", " ")}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm">
                  <span className="font-semibold">{lead.confidenceScore}</span>
                  <span className="ml-1 text-xs text-slate-500">
                    {lead.confidenceLevel}
                  </span>
                </td>
                <td className="max-w-64 px-4 py-4 text-sm">
                  {lead.email ? (
                    <a
                      className="inline-flex items-center gap-1.5 text-slate-700 hover:text-brand-700 hover:underline"
                      href={`mailto:${lead.email}`}
                    >
                      <Mail aria-hidden="true" className="size-3.5 shrink-0" />
                      <span className="truncate">{lead.email}</span>
                    </a>
                  ) : (
                    <OptionalValue value={null} />
                  )}
                </td>
                <td className="max-w-52 px-4 py-4 text-sm">
                  {website ? (
                    <a
                      className="inline-flex items-center gap-1.5 text-brand-700 hover:underline"
                      href={website}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Website
                      <ExternalLink aria-hidden="true" className="size-3.5" />
                    </a>
                  ) : (
                    <OptionalValue value={lead.website} />
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm">
                  <OptionalValue value={lead.category} />
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm">
                  <OptionalValue value={lead.city} />
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm">
                  <OptionalValue value={lead.state} />
                </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                    {lead.sourceType.replaceAll("_", " ")}
                  </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                  {lead.lastVerifiedAt
                    ? formatDateTime(lead.lastVerifiedAt)
                    : "Not verified"}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                  {lead.provenanceCount}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                  {formatDateTime(lead.createdAt)}
                </td>
                <td className="px-4 py-4">
                  <Link
                    aria-label={`View ${lead.businessName}`}
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    state={{ returnTo }}
                    to={`/dashboard/leads/${lead.id}`}
                  >
                    <Eye aria-hidden="true" className="size-3.5" />
                    View
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
