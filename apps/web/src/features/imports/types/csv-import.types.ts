import type { CsvImportSummary } from "@lead-saas/shared-types";

export type { CsvImportSummary };

export type CsvPreview = {
  headers: string[];
  detectedMapping: Readonly<Record<string, string>>;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: ReadonlyArray<{ row: number; code: string; message: string }>;
  preview: ReadonlyArray<{
    rowNumber: number;
    businessName: string;
    phone?: string;
    email?: string;
    website?: string;
    city?: string;
    state?: string;
  }>;
};
