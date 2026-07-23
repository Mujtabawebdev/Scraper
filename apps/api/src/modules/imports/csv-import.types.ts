export const csvCanonicalFields = [
  "businessName",
  "phone",
  "email",
  "website",
  "category",
  "address",
  "city",
  "state",
  "postalCode",
  "country",
  "sourceRecordId",
] as const;

export type CsvCanonicalField = (typeof csvCanonicalFields)[number];

export type CsvHeaderMapping = Partial<Record<CsvCanonicalField, string>>;

export type StagedCsvRow = {
  rowNumber: number;
  businessName: string;
  phone?: string;
  email?: string;
  website?: string;
  category?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;
  sourceRecordId?: string;
};

export type CsvRowError = {
  row: number;
  code: string;
  message: string;
};

export type CsvPreview = {
  headers: string[];
  detectedMapping: CsvHeaderMapping;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: CsvRowError[];
  preview: StagedCsvRow[];
  stagedRows: StagedCsvRow[];
};
