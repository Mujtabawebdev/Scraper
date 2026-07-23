import { env } from "../../../config/env.js";
import { prisma } from "../../../infrastructure/database/prisma.js";
import { ScraperError } from "../errors/scraper.error.js";

export type WorkerSourcePolicy = {
  sourceKey: string;
  baseUrl: string | null;
  requestsPerMinute: number;
  maxConcurrency: number;
};

const databaseKey = (sourceKey: string): string =>
  sourceKey === "fixture-directory" ? "fixture-business-directory" : sourceKey;

const policyError = (code: string, message: string): ScraperError =>
  new ScraperError(message, code);

const hasRequiredCredential = (sourceKey: string): boolean => {
  if (sourceKey === "google-places-api") {
    return Boolean(env.GOOGLE_PLACES_API_KEY);
  }
  if (sourceKey === "meta-approved-api") {
    return Boolean(env.META_APPROVED_API_ACCESS_TOKEN);
  }
  if (sourceKey === "yelp-approved-api") {
    return Boolean(env.YELP_APPROVED_API_KEY);
  }
  const variableName = `SOURCE_${sourceKey
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")}_API_KEY`;
  return Boolean(process.env[variableName]?.trim());
};

export const getApprovedSource = async (sourceKey: string) => {
  const source = await prisma.approvedSource.findUnique({
    where: { key: databaseKey(sourceKey) },
    select: {
      key: true,
      sourceType: true,
      baseUrl: true,
      status: true,
      isEnabled: true,
      allowsAutomatedAccess: true,
      requiresApiKey: true,
      requestsPerMinute: true,
      maxConcurrency: true,
    },
  });
  if (!source) {
    throw policyError("SOURCE_NOT_APPROVED", "Source is not on the allowlist");
  }
  return source;
};

export const assertSourceEnabled = async (sourceKey: string) => {
  const source = await getApprovedSource(sourceKey);
  if (
    source.sourceType === "FIXTURE" &&
    env.NODE_ENV !== "test" &&
    !env.SCRAPING_FIXTURE_SOURCE_ENABLED
  ) {
    throw policyError(
      "SOURCE_NOT_APPROVED",
      "Fixture source is restricted to tests and explicit test mode",
    );
  }
  if (source.status === "BLOCKED") {
    throw policyError("SOURCE_BLOCKED", "Source has been blocked");
  }
  if (source.status === "REVIEW_REQUIRED") {
    throw policyError("SOURCE_REVIEW_REQUIRED", "Source requires review");
  }
  if (source.status !== "APPROVED" || !source.isEnabled) {
    throw policyError("SOURCE_NOT_APPROVED", "Source is not enabled");
  }
  return source;
};

export const assertAutomatedAccessAllowed = async (
  sourceKey: string,
): Promise<WorkerSourcePolicy> => {
  const source = await assertSourceEnabled(sourceKey);
  if (!source.allowsAutomatedAccess) {
    throw policyError(
      "AUTOMATED_ACCESS_NOT_ALLOWED",
      "Automated access is not permitted",
    );
  }
  if (source.requiresApiKey) {
    if (!hasRequiredCredential(source.key)) {
      throw policyError(
        "API_CREDENTIALS_MISSING",
        "Required source credential is not configured",
      );
    }
  }
  if (sourceKey === "permitted-http-directory") {
    if (!source.baseUrl || !env.SCRAPING_APPROVED_BASE_URL) {
      throw policyError(
        "SOURCE_REVIEW_REQUIRED",
        "Approved source URL is not configured",
      );
    }
    try {
      if (
        new URL(source.baseUrl).origin !==
        new URL(env.SCRAPING_APPROVED_BASE_URL).origin
      ) {
        throw policyError(
          "SOURCE_REVIEW_REQUIRED",
          "Runtime source URL differs from the reviewed origin",
        );
      }
    } catch (error: unknown) {
      if (error instanceof ScraperError) throw error;
      throw policyError(
        "SOURCE_REVIEW_REQUIRED",
        "Approved source URL is invalid",
      );
    }
  }
  return {
    sourceKey: source.key,
    baseUrl: source.baseUrl,
    requestsPerMinute: source.requestsPerMinute,
    maxConcurrency: source.maxConcurrency,
  };
};

export const markSourceBlocked = async (
  sourceKey: string,
  reason: string,
): Promise<void> => {
  await prisma.approvedSource.updateMany({
    where: { key: databaseKey(sourceKey) },
    data: {
      status: "BLOCKED",
      isEnabled: false,
      allowsAutomatedAccess: false,
      blockedReason: reason.slice(0, 500),
    },
  });
};

export const markSourceReviewRequired = async (
  sourceKey: string,
  reason: string,
): Promise<void> => {
  await prisma.approvedSource.updateMany({
    where: { key: databaseKey(sourceKey) },
    data: {
      status: "REVIEW_REQUIRED",
      isEnabled: false,
      allowsAutomatedAccess: false,
      reviewNotes: reason.slice(0, 2_000),
      blockedReason: null,
    },
  });
};

export const recordRobotsCheck = async (sourceKey: string): Promise<void> => {
  await prisma.approvedSource.updateMany({
    where: { key: databaseKey(sourceKey) },
    data: { robotsPolicyCheckedAt: new Date() },
  });
};

export const getRateLimitPolicy = async (
  sourceKey: string,
): Promise<Pick<WorkerSourcePolicy, "requestsPerMinute" | "maxConcurrency">> => {
  const source = await assertAutomatedAccessAllowed(sourceKey);
  return {
    requestsPerMinute: source.requestsPerMinute,
    maxConcurrency: source.maxConcurrency,
  };
};
