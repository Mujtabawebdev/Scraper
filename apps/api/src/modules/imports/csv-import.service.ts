import { createHash } from "node:crypto";
import type { CsvImportSummary } from "@lead-saas/shared-types";

import { logger } from "../../common/logger/logger.js";
import { enqueueCsvImport } from "../../infrastructure/queue/csv-import.queue.js";
import {
  csvImportInvalidError,
  csvImportNotFoundError,
  csvImportQueueUnavailableError,
} from "./csv-import.errors.js";
import {
  createCsvImportRecord,
  findOwnedCsvImport,
  markCsvImportQueued,
  markCsvImportQueueFailed,
  type CsvImportRecord,
} from "./csv-import.repository.js";
import { parseBusinessCsv } from "./csv-parser.service.js";
import type { CsvHeaderMapping, CsvRowError } from "./csv-import.types.js";

const safeErrors = (value: unknown): CsvRowError[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is { row: number; code: string; message: string } =>
        typeof item === "object" &&
        item !== null &&
        "row" in item &&
        typeof item.row === "number" &&
        "code" in item &&
        typeof item.code === "string" &&
        "message" in item &&
        typeof item.message === "string",
    )
    .slice(0, 100)
    .map((item) => ({
      row: item.row,
      code: item.code,
      message: item.message,
    }));
};

const mapImport = (record: CsvImportRecord): CsvImportSummary => ({
  id: record.id,
  originalFilename: record.originalFilename,
  sourceName: record.sourceName,
  status: record.status,
  totalRows: record.totalRows,
  validRows: record.validRows,
  invalidRows: record.invalidRows,
  duplicateRows: record.duplicateRows,
  importedRows: record.importedRows,
  errors: safeErrors(record.errorReport),
  createdAt: record.createdAt.toISOString(),
  completedAt: record.completedAt?.toISOString() ?? null,
});

export const previewCsvImport = (
  file: Express.Multer.File,
  mapping: CsvHeaderMapping,
) => {
  const preview = parseBusinessCsv(file.buffer, mapping);
  const { stagedRows: _stagedRows, ...safePreview } = preview;
  return safePreview;
};

export const createCsvImport = async (input: {
  userId: string;
  file: Express.Multer.File;
  sourceName: string;
  mapping: CsvHeaderMapping;
}): Promise<CsvImportSummary> => {
  const parsed = parseBusinessCsv(input.file.buffer, input.mapping);
  if (parsed.validRows === 0) {
    throw csvImportInvalidError("CSV contains no valid business rows");
  }
  const hash = createHash("sha256").update(input.file.buffer).digest("hex");
  const created = await createCsvImportRecord({
    userId: input.userId,
    originalFilename: input.file.originalname,
    sourceName: input.sourceName,
    fileSha256: hash,
    mapping: parsed.detectedMapping,
    rows: parsed.stagedRows,
    totalRows: parsed.totalRows,
    invalidRows: parsed.invalidRows,
    errors: parsed.errors,
  });
  try {
    await enqueueCsvImport({
      importId: created.csvImport.id,
      scrapingJobId: created.scrapingJobId,
      requestedById: input.userId,
    });
    await markCsvImportQueued(created.csvImport.id, input.userId);
  } catch (error: unknown) {
    await markCsvImportQueueFailed(created.csvImport.id, input.userId).catch(
      () => undefined,
    );
    logger.error(
      {
        importId: created.csvImport.id,
        errorType: error instanceof Error ? error.name : "UnknownError",
      },
      "CSV import queue submission failed",
    );
    throw csvImportQueueUnavailableError();
  }
  const queued = await findOwnedCsvImport(created.csvImport.id, input.userId);
  return mapImport(queued ?? { ...created.csvImport, status: "QUEUED" });
};

export const getCsvImport = async (
  userId: string,
  importId: string,
): Promise<CsvImportSummary> => {
  const record = await findOwnedCsvImport(importId, userId);
  if (!record) throw csvImportNotFoundError();
  return mapImport(record);
};
