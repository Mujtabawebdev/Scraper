import { exportLimitExceededError } from "./lead.errors.js";
import { listOwnedLeadsForExport } from "./lead.repository.js";
import type { ExportLeadsQuery } from "./lead.types.js";

export const LEAD_EXPORT_ROW_LIMIT = 10_000;

const CSV_HEADERS = [
  "Business Name",
  "Phone",
  "Email",
  "Website",
  "Category",
  "Address",
  "City",
  "State",
  "Postal Code",
  "Country",
  "Source",
  "Source URL",
  "Created At",
] as const;

export const escapeCsvCell = (value: string | null): string => {
  let safeValue = value ?? "";
  if (/^[\t\r\n]/.test(safeValue) || /^\s*[=+\-@]/.test(safeValue)) {
    safeValue = `'${safeValue}`;
  }
  return `"${safeValue.replaceAll('"', '""')}"`;
};

export const exportLeadsCsv = async (
  userId: string,
  query: ExportLeadsQuery,
): Promise<string> => {
  const leads = await listOwnedLeadsForExport(
    userId,
    query,
    LEAD_EXPORT_ROW_LIMIT + 1,
  );
  if (leads.length > LEAD_EXPORT_ROW_LIMIT) {
    throw exportLimitExceededError(LEAD_EXPORT_ROW_LIMIT);
  }

  const rows = leads.map((lead) => {
    const address = [lead.addressLine1, lead.addressLine2]
      .filter((value): value is string => Boolean(value))
      .join(", ");
    return [
      lead.businessName,
      lead.phoneRaw,
      lead.email,
      lead.website,
      lead.category,
      address || null,
      lead.city,
      lead.state,
      lead.postalCode,
      lead.country,
      lead.scrapingJob.source,
      lead.sourceUrl,
      lead.createdAt.toISOString(),
    ]
      .map(escapeCsvCell)
      .join(",");
  });

  return `\uFEFF${[CSV_HEADERS.map(escapeCsvCell).join(","), ...rows].join("\r\n")}\r\n`;
};
