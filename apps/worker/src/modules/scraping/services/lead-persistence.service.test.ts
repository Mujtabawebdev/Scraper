import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseMocks = vi.hoisted(() => {
  const findFirst = vi.fn();
  const create = vi.fn();
  const executeRaw = vi.fn();
  const transactionClient = {
    $executeRaw: executeRaw,
    lead: { findFirst, create },
  };
  const transaction = vi.fn(
    async (
      operation: (client: typeof transactionClient) => Promise<unknown>,
    ): Promise<unknown> => operation(transactionClient),
  );
  return { findFirst, create, executeRaw, transaction, transactionClient };
});

vi.mock("../../../infrastructure/database/prisma.js", () => ({
  prisma: {
    $transaction: databaseMocks.transaction,
  },
}));

import type { NormalizedBusiness } from "./lead-normalization.service.js";
import { persistLeads } from "./lead-persistence.service.js";

const userId = "00000000-0000-4000-8000-000000000001";
const scrapingJobId = "00000000-0000-4000-8000-000000000002";

const record: NormalizedBusiness = {
  businessName: "Example Roofing",
  phoneRaw: "2025550101",
  phoneNormalized: "+12025550101",
  phoneType: "UNKNOWN",
  email: "info@example.test",
  website: "https://example.test/",
  domain: "example.test",
  addressLine1: "1 Test Road",
  addressLine2: null,
  city: "Houston",
  state: "TX",
  postalCode: "77001",
  country: "United States",
  category: "Roofing",
  sourceType: "BUSINESS_DIRECTORY",
  sourceName: "Fixture",
  sourceUrl: "fixture://directory/1",
  sourceExternalId: "one",
};

describe("persistLeads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.transaction.mockImplementation(
      async (operation) => operation(databaseMocks.transactionClient),
    );
    databaseMocks.findFirst.mockResolvedValue(null);
    databaseMocks.create.mockResolvedValue({ id: "lead-id" });
    databaseMocks.executeRaw.mockResolvedValue(1);
  });

  it("scopes deduplication and new leads to the owning user", async () => {
    const result = await persistLeads([record], { scrapingJobId, userId });

    expect(databaseMocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId }),
      }),
    );
    expect(databaseMocks.executeRaw).toHaveBeenCalledWith(
      expect.anything(),
      userId,
    );
    expect(databaseMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId, scrapingJobId }),
      }),
    );
    expect(result).toEqual({ successCount: 1, duplicateCount: 0, cancelled: false });
  });

  it("reports another owned job's matching lead as a duplicate", async () => {
    databaseMocks.findFirst.mockResolvedValue({
      scrapingJobId: "00000000-0000-4000-8000-000000000003",
    });

    const result = await persistLeads([record], { scrapingJobId, userId });

    expect(databaseMocks.create).not.toHaveBeenCalled();
    expect(result).toEqual({ successCount: 0, duplicateCount: 1, cancelled: false });
  });

  it("counts an idempotent same-job match as a success", async () => {
    databaseMocks.findFirst.mockResolvedValue({ scrapingJobId });

    const result = await persistLeads([record], { scrapingJobId, userId });

    expect(databaseMocks.create).not.toHaveBeenCalled();
    expect(result).toEqual({ successCount: 1, duplicateCount: 0, cancelled: false });
  });

  it("serializes concurrent same-user lookup and insert operations", async () => {
    let storedJobId: string | null = null;
    let lockTail = Promise.resolve();
    databaseMocks.findFirst.mockImplementation(async () =>
      storedJobId ? { scrapingJobId: storedJobId } : null,
    );
    databaseMocks.create.mockImplementation(
      async (args: { data: { scrapingJobId: string } }) => {
        storedJobId = args.data.scrapingJobId;
        return { id: "lead-id" };
      },
    );
    databaseMocks.transaction.mockImplementation(async (operation) => {
      const precedingLock = lockTail;
      let releaseLock = (): void => undefined;
      lockTail = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });
      const transactionClient = {
        $executeRaw: vi.fn(async (...queryArguments: unknown[]) => {
          databaseMocks.executeRaw(...queryArguments);
          await precedingLock;
          return 1;
        }),
        lead: {
          findFirst: databaseMocks.findFirst,
          create: databaseMocks.create,
        },
      };

      try {
        return await operation(transactionClient);
      } finally {
        releaseLock();
      }
    });

    const [first, second] = await Promise.all([
      persistLeads([record], { scrapingJobId, userId }),
      persistLeads([record], { scrapingJobId, userId }),
    ]);

    expect(databaseMocks.create).toHaveBeenCalledTimes(1);
    expect(databaseMocks.executeRaw).toHaveBeenCalledTimes(2);
    expect(first).toEqual({ successCount: 1, duplicateCount: 0, cancelled: false });
    expect(second).toEqual({ successCount: 1, duplicateCount: 0, cancelled: false });
  });

  it("stops before the next lead when cancellation is requested", async () => {
    const result = await persistLeads([record], {
      scrapingJobId,
      userId,
      shouldCancel: vi.fn().mockResolvedValue(true),
    });

    expect(databaseMocks.findFirst).not.toHaveBeenCalled();
    expect(databaseMocks.create).not.toHaveBeenCalled();
    expect(result).toEqual({ successCount: 0, duplicateCount: 0, cancelled: true });
  });

  it("publishes database progress in bounded batches with actual counts", async () => {
    const onProgress = vi.fn().mockResolvedValue(true);
    const records = Array.from({ length: 11 }, (_value, index) => ({
      ...record,
      sourceExternalId: `record-${index}`,
    }));

    const result = await persistLeads(records, {
      scrapingJobId,
      userId,
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, {
      completed: 10,
      total: 11,
      successCount: 10,
      duplicateCount: 0,
    });
    expect(onProgress).toHaveBeenNthCalledWith(2, {
      completed: 11,
      total: 11,
      successCount: 11,
      duplicateCount: 0,
    });
    expect(result).toEqual({ successCount: 11, duplicateCount: 0, cancelled: false });
  });
});
