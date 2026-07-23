import type {
  CsvImportJobName,
  CsvImportQueueData,
  CsvImportQueueResult,
} from "@lead-saas/shared-types";
import { Prisma } from "@lead-saas/api/prisma-client";
import { type Job, UnrecoverableError } from "bullmq";
import { z } from "zod";

import { prisma } from "../../infrastructure/database/prisma.js";
import type { ScrapedBusiness } from "../../modules/scraping/contracts/scraped-business.types.js";
import { deduplicateBatch } from "../../modules/scraping/services/lead-deduplication.service.js";
import { normalizeBusiness } from "../../modules/scraping/services/lead-normalization.service.js";
import { persistLeads } from "../../modules/scraping/services/lead-persistence.service.js";

const stagedRowSchema = z
  .object({
    rowNumber: z.number().int().min(2),
    businessName: z.string().trim().min(1).max(255),
    phone: z.string().max(100).optional(),
    email: z.string().email().max(320).optional(),
    website: z.url().optional(),
    category: z.string().max(150).optional(),
    address: z.string().max(255).optional(),
    city: z.string().max(120).optional(),
    state: z.string().max(100).optional(),
    postalCode: z.string().max(20).optional(),
    country: z.string().min(1).max(100),
    sourceRecordId: z.string().max(255).optional(),
  })
  .strict();

const importErrorMessage = "CSV import could not be processed";

export const processCsvImport = async (
  job: Job<CsvImportQueueData, CsvImportQueueResult, CsvImportJobName>,
): Promise<CsvImportQueueResult> => {
  const record = await prisma.csvImport.findFirst({
    where: {
      id: job.data.importId,
      userId: job.data.requestedById,
      scrapingJobId: job.data.scrapingJobId,
    },
    select: {
      id: true,
      userId: true,
      scrapingJobId: true,
      sourceName: true,
      stagedRows: true,
      invalidRows: true,
      status: true,
    },
  });
  if (!record || !record.scrapingJobId) {
    throw new UnrecoverableError("CSV_IMPORT_NOT_FOUND");
  }
  const parsedRows = z.array(stagedRowSchema).safeParse(record.stagedRows);
  if (!parsedRows.success || parsedRows.data.length === 0) {
    throw new UnrecoverableError("CSV_IMPORT_STAGING_INVALID");
  }

  const startedAt = new Date();
  const transition = await prisma.$transaction(async (transaction) => {
    const csv = await transaction.csvImport.updateMany({
      where: { id: record.id, userId: record.userId, status: { in: ["PENDING", "QUEUED"] } },
      data: { status: "PROCESSING", startedAt },
    });
    const scraping = await transaction.scrapingJob.updateMany({
      where: {
        id: record.scrapingJobId!,
        userId: record.userId,
        status: { in: ["PENDING", "QUEUED"] },
      },
      data: {
        status: "RUNNING",
        startedAt,
        pipelineStage: "NORMALIZE_PHONE",
        progressPercentage: 10,
      },
    });
    return csv.count === 1 && scraping.count === 1;
  });
  if (!transition) throw new UnrecoverableError("CSV_IMPORT_STATE_INVALID");

  try {
    const scraped: ScrapedBusiness[] = parsedRows.data.map((row) => ({
      businessName: row.businessName,
      country: row.country,
      sourceType: "CSV_IMPORT",
      sourceName: record.sourceName,
      sourceUrl: `urn:lead-saas:csv-import:${record.id}`,
      ...(row.phone ? { phoneRaw: row.phone } : {}),
      ...(row.email ? { email: row.email } : {}),
      ...(row.website ? { website: row.website } : {}),
      ...(row.category ? { category: row.category } : {}),
      ...(row.address ? { addressLine1: row.address } : {}),
      ...(row.city ? { city: row.city } : {}),
      ...(row.state ? { state: row.state } : {}),
      ...(row.postalCode ? { postalCode: row.postalCode } : {}),
      ...(row.sourceRecordId ? { sourceExternalId: row.sourceRecordId } : {}),
      provenance: [
        {
          sourceKey: "licensed-csv-import",
          sourceType: "CSV_IMPORT",
          sourceRecordId: row.sourceRecordId ?? `row-${row.rowNumber}`,
          collectedAt: startedAt,
          extractionMethod: "CSV_COLUMN",
          ...(row.phone ? { phoneRaw: row.phone } : {}),
          ...(row.email ? { email: row.email } : {}),
          ...(row.website ? { website: row.website } : {}),
          sourceConfidenceScore: row.phone ? 55 : 35,
          confidenceContribution: row.phone ? 20 : 10,
          metadata: {
            importId: record.id,
            rowNumber: row.rowNumber,
            rightsConfirmed: true,
          },
        },
      ],
    }));
    await prisma.scrapingJob.updateMany({
      where: { id: record.scrapingJobId, userId: record.userId, status: "RUNNING" },
      data: { pipelineStage: "DEDUPLICATE", progressPercentage: 35 },
    });
    await job.updateProgress(35);
    const normalized = scraped
      .map(normalizeBusiness)
      .filter((item) => item !== null);
    const batch = deduplicateBatch(normalized);
    await prisma.scrapingJob.updateMany({
      where: { id: record.scrapingJobId, userId: record.userId, status: "RUNNING" },
      data: {
        pipelineStage: "PERSIST_LEAD",
        progressPercentage: 55,
        processedCount: parsedRows.data.length,
        failureCount: record.invalidRows,
        duplicateCount: batch.duplicates,
      },
    });
    const shouldCancel = async (): Promise<boolean> => {
      const current = await prisma.scrapingJob.findUnique({
        where: { id: record.scrapingJobId! },
        select: { status: true, userId: true },
      });
      if (!current || current.userId !== record.userId) {
        throw new UnrecoverableError("CSV_IMPORT_OWNERSHIP_MISMATCH");
      }
      return current.status === "CANCELLED";
    };
    const persisted = await persistLeads(batch.unique, {
      scrapingJobId: record.scrapingJobId,
      userId: record.userId,
      sourceKey: "licensed-csv-import",
      shouldCancel,
      onProgress: async (progress) => {
        const percentage =
          progress.total === 0
            ? 90
            : 55 + Math.round((progress.completed / progress.total) * 40);
        const updated = await prisma.scrapingJob.updateMany({
          where: {
            id: record.scrapingJobId!,
            userId: record.userId,
            status: "RUNNING",
          },
          data: {
            progressPercentage: Math.min(95, percentage),
            successCount: progress.successCount,
            duplicateCount: batch.duplicates + progress.duplicateCount,
          },
        });
        if (updated.count === 0) return false;
        await job.updateProgress(Math.min(95, percentage));
        return true;
      },
    });
    const duplicateRows = batch.duplicates + persisted.duplicateCount;
    const completedAt = new Date();
    if (persisted.cancelled) {
      await prisma.csvImport.updateMany({
        where: { id: record.id, userId: record.userId, status: "PROCESSING" },
        data: {
          status: "PARTIAL",
          importedRows: persisted.successCount,
          duplicateRows,
          completedAt,
          stagedRows: Prisma.DbNull,
        },
      });
    } else {
      await prisma.$transaction([
        prisma.csvImport.updateMany({
          where: { id: record.id, userId: record.userId, status: "PROCESSING" },
          data: {
            status: record.invalidRows > 0 ? "PARTIAL" : "COMPLETED",
            importedRows: persisted.successCount,
            duplicateRows,
            completedAt,
            stagedRows: Prisma.DbNull,
          },
        }),
        prisma.scrapingJob.updateMany({
          where: {
            id: record.scrapingJobId,
            userId: record.userId,
            status: "RUNNING",
          },
          data: {
            status: "COMPLETED",
            pipelineStage: "COMPLETE_JOB",
            progressPercentage: 100,
            processedCount: parsedRows.data.length,
            successCount: persisted.successCount,
            failureCount: record.invalidRows,
            duplicateCount: duplicateRows,
            completedAt,
          },
        }),
      ]);
      await job.updateProgress(100);
    }
    return {
      importId: record.id,
      importedRows: persisted.successCount,
      duplicateRows,
      invalidRows: record.invalidRows,
      completedAt: completedAt.toISOString(),
    };
  } catch (error: unknown) {
    const failedAt = new Date();
    await prisma.$transaction([
      prisma.csvImport.updateMany({
        where: { id: record.id, userId: record.userId, status: "PROCESSING" },
        data: { status: "FAILED", failedAt, stagedRows: Prisma.DbNull },
      }),
      prisma.scrapingJob.updateMany({
        where: {
          id: record.scrapingJobId,
          userId: record.userId,
          status: "RUNNING",
        },
        data: { status: "FAILED", failedAt, errorMessage: importErrorMessage },
      }),
    ]);
    throw error;
  }
};
