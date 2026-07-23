import { parse } from "csv-parse/sync";

import { env } from "../../config/env.js";
import { validateLeadPhone } from "../leads/lead-phone.service.js";
import {
  csvImportInvalidError,
  csvImportLimitExceededError,
} from "./csv-import.errors.js";
import type {
  CsvCanonicalField,
  CsvHeaderMapping,
  CsvPreview,
  CsvRowError,
  StagedCsvRow,
} from "./csv-import.types.js";

const aliases: Record<CsvCanonicalField, readonly string[]> = {
  businessName: ["businessname", "business", "company", "companyname", "name"],
  phone: ["phone", "telephone", "businessphone", "phonenumber"],
  email: ["email", "businessemail", "emailaddress"],
  website: ["website", "url", "businesswebsite"],
  category: ["category", "industry", "type"],
  address: ["address", "streetaddress", "addressline1"],
  city: ["city", "locality"],
  state: ["state", "region", "province"],
  postalCode: ["postalcode", "zipcode", "zip"],
  country: ["country", "countrycode"],
  sourceRecordId: ["sourcerecordid", "externalid", "registrationid", "id"],
};

const normalizeHeader = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const clean = (value: unknown): string | undefined =>
  typeof value === "string"
    ? value.trim().replace(/\s+/g, " ") || undefined
    : undefined;

const safeEmail = (value: string | undefined): string | undefined => {
  const email = value?.toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? email
    : undefined;
};

const safeWebsite = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
};

const detectMapping = (headers: string[]): CsvHeaderMapping => {
  const normalized = new Map(
    headers.map((header) => [normalizeHeader(header), header]),
  );
  const mapping: CsvHeaderMapping = {};
  for (const [field, candidates] of Object.entries(aliases) as Array<
    [CsvCanonicalField, readonly string[]]
  >) {
    const match = candidates
      .map((candidate) => normalized.get(candidate))
      .find(Boolean);
    if (match) mapping[field] = match;
  }
  return mapping;
};

const readMapped = (
  record: Readonly<Record<string, string>>,
  mapping: CsvHeaderMapping,
  field: CsvCanonicalField,
): string | undefined => {
  const header = mapping[field];
  return header ? clean(record[header]) : undefined;
};

export const parseBusinessCsv = (
  buffer: Buffer,
  suppliedMapping: CsvHeaderMapping = {},
): CsvPreview => {
  if (
    buffer.length === 0 ||
    buffer.length > env.CSV_IMPORT_MAX_FILE_BYTES ||
    buffer.includes(0)
  ) {
    throw csvImportLimitExceededError();
  }
  let records: Array<Record<string, string>>;
  try {
    records = parse<Record<string, string>>(buffer, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
      max_record_size: 64 * 1_024,
    });
  } catch {
    throw csvImportInvalidError("CSV syntax or column structure is invalid");
  }
  if (records.length > env.CSV_IMPORT_MAX_ROWS) {
    throw csvImportLimitExceededError();
  }
  const headers = records[0] ? Object.keys(records[0]) : [];
  if (headers.length === 0 || headers.length > 100) {
    throw csvImportInvalidError("CSV must contain a bounded header row");
  }
  const mapping = { ...detectMapping(headers), ...suppliedMapping };
  if (!mapping.businessName) {
    throw csvImportInvalidError("A business-name column mapping is required");
  }
  if (
    Object.values(mapping).some(
      (header) => header !== undefined && !headers.includes(header),
    )
  ) {
    throw csvImportInvalidError("Header mapping references an unknown column");
  }

  const errors: CsvRowError[] = [];
  const stagedRows: StagedCsvRow[] = [];
  for (const [index, record] of records.entries()) {
    const rowNumber = index + 2;
    const businessName = readMapped(record, mapping, "businessName");
    if (!businessName || businessName.length > 255) {
      errors.push({
        row: rowNumber,
        code: "BUSINESS_NAME_INVALID",
        message: "Business name is required and must not exceed 255 characters",
      });
      continue;
    }
    const rawPhone = readMapped(record, mapping, "phone");
    const phone = validateLeadPhone(rawPhone ?? null);
    if (
      rawPhone &&
      (phone.phoneValidationStatus === "INVALID" ||
        phone.phoneValidationStatus === "PLACEHOLDER")
    ) {
      errors.push({
        row: rowNumber,
        code: "PHONE_INVALID",
        message: "Phone is invalid or a reserved placeholder",
      });
      continue;
    }
    const rawEmail = readMapped(record, mapping, "email");
    const email = safeEmail(rawEmail);
    if (rawEmail && !email) {
      errors.push({
        row: rowNumber,
        code: "EMAIL_INVALID",
        message: "Email format is invalid",
      });
      continue;
    }
    const rawWebsite = readMapped(record, mapping, "website");
    const website = safeWebsite(rawWebsite);
    if (rawWebsite && !website) {
      errors.push({
        row: rowNumber,
        code: "WEBSITE_INVALID",
        message: "Website must use HTTP or HTTPS",
      });
      continue;
    }
    const category = readMapped(record, mapping, "category");
    const address = readMapped(record, mapping, "address");
    const city = readMapped(record, mapping, "city");
    const state = readMapped(record, mapping, "state");
    const postalCode = readMapped(record, mapping, "postalCode");
    const sourceRecordId = readMapped(record, mapping, "sourceRecordId");
    stagedRows.push({
      rowNumber,
      businessName,
      country: readMapped(record, mapping, "country") ?? "United States",
      ...(rawPhone ? { phone: rawPhone } : {}),
      ...(email ? { email } : {}),
      ...(website ? { website } : {}),
      ...(category ? { category } : {}),
      ...(address ? { address } : {}),
      ...(city ? { city } : {}),
      ...(state ? { state } : {}),
      ...(postalCode ? { postalCode } : {}),
      ...(sourceRecordId ? { sourceRecordId } : {}),
    });
  }

  return {
    headers,
    detectedMapping: mapping,
    totalRows: records.length,
    validRows: stagedRows.length,
    invalidRows: errors.length,
    errors: errors.slice(0, 100),
    preview: stagedRows.slice(0, 5),
    stagedRows,
  };
};
