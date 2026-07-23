import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import type {
  CsvHeaderMapping,
  CsvRowError,
  StagedCsvRow,
} from "./csv-import.types.js";

const importSelect = {
  id: true,
  originalFilename: true,
  sourceName: true,
  status: true,
  totalRows: true,
  validRows: true,
  invalidRows: true,
  duplicateRows: true,
  importedRows: true,
  errorReport: true,
  createdAt: true,
  completedAt: true,
} satisfies Prisma.CsvImportSelect;

export type CsvImportRecord = Prisma.CsvImportGetPayload<{
  select: typeof importSelect;
}>;

export const createCsvImportRecord = async (input: {
  userId: string;
  originalFilename: string;
  sourceName: string;
  fileSha256: string;
  mapping: CsvHeaderMapping;
  rows: StagedCsvRow[];
  totalRows: number;
  invalidRows: number;
  errors: CsvRowError[];
}): Promise<{ csvImport: CsvImportRecord; scrapingJobId: string }> =>
  prisma.$transaction(async (transaction) => {
    const source = await transaction.approvedSource.findUnique({
      where: { key: "licensed-csv-import" },
      select: { id: true, status: true, isEnabled: true },
    });
    if (!source || source.status !== "APPROVED" || !source.isEnabled) {
      throw new Error("CSV_SOURCE_NOT_APPROVED");
    }
    const job = await transaction.scrapingJob.create({
      data: {
        name: `CSV import: ${input.sourceName}`.slice(0, 150),
        source: "licensed-csv-import",
        country: "United States",
        location: "Imported dataset",
        searchQuery: input.originalFilename,
        requestedLimit: input.rows.length,
        status: "PENDING",
        pipelineStage: "DEDUPLICATE",
        userId: input.userId,
      },
      select: { id: true },
    });
    const csvImport = await transaction.csvImport.create({
      data: {
        userId: input.userId,
        approvedSourceId: source.id,
        scrapingJobId: job.id,
        originalFilename: input.originalFilename,
        sourceName: input.sourceName,
        fileSha256: input.fileSha256,
        rightsConfirmedAt: new Date(),
        status: "PENDING",
        totalRows: input.totalRows,
        validRows: input.rows.length,
        invalidRows: input.invalidRows,
        headerMapping: { ...input.mapping },
        stagedRows: input.rows.map((row) => ({ ...row })),
        errorReport: input.errors.map((error) => ({ ...error })),
      },
      select: importSelect,
    });
    await transaction.auditLog.create({
      data: {
        action: "CSV_IMPORT_QUEUED",
        entityType: "CSV_IMPORT",
        entityId: csvImport.id,
        actorId: input.userId,
        metadata: {
          summary: "Rights-confirmed CSV import queued",
          sourceName: input.sourceName,
          totalRows: input.totalRows,
          validRows: input.rows.length,
          invalidRows: input.invalidRows,
        },
      },
    });
    return { csvImport, scrapingJobId: job.id };
  });

export const markCsvImportQueued = async (
  importId: string,
  userId: string,
): Promise<void> => {
  await prisma.$transaction([
    prisma.csvImport.updateMany({
      where: { id: importId, userId, status: "PENDING" },
      data: { status: "QUEUED" },
    }),
    prisma.scrapingJob.updateMany({
      where: { csvImports: { some: { id: importId, userId } }, status: "PENDING" },
      data: { status: "QUEUED", queueJobId: importId },
    }),
  ]);
};

export const markCsvImportQueueFailed = async (
  importId: string,
  userId: string,
): Promise<void> => {
  const now = new Date();
  await prisma.$transaction([
    prisma.csvImport.updateMany({
      where: { id: importId, userId, status: { in: ["PENDING", "QUEUED"] } },
      data: { status: "FAILED", failedAt: now, stagedRows: Prisma.DbNull },
    }),
    prisma.scrapingJob.updateMany({
      where: {
        csvImports: { some: { id: importId, userId } },
        status: { in: ["PENDING", "QUEUED"] },
      },
      data: {
        status: "FAILED",
        failedAt: now,
        errorMessage: "CSV import queue submission failed",
      },
    }),
  ]);
};

export const findOwnedCsvImport = async (
  importId: string,
  userId: string,
): Promise<CsvImportRecord | null> =>
  prisma.csvImport.findFirst({
    where: { id: importId, userId },
    select: importSelect,
  });
