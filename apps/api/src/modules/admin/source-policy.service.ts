import type { ApprovedSource } from "@lead-saas/shared-types";

import { env } from "../../config/env.js";
import {
  automatedAccessNotAllowedError,
  sourceBlockedError,
  sourceNotApprovedError,
  sourceNotFoundError,
  sourceReviewRequiredError,
} from "./admin.errors.js";
import {
  findApprovedSourceByKey,
  recordSourceRobotsCheck,
  setSourcePolicyState,
} from "./admin.repository.js";
import { mapApprovedSource } from "./admin.mapper.js";

export type SourceRateLimitPolicy = {
  requestsPerMinute: number;
  maxConcurrency: number;
};

export const getApprovedSource = async (
  sourceKey: string,
): Promise<ApprovedSource> => {
  const source = await findApprovedSourceByKey(sourceKey);
  if (!source) throw sourceNotFoundError();
  return mapApprovedSource(source);
};

const assertFixtureMode = (source: ApprovedSource): void => {
  if (
    source.sourceType === "FIXTURE" &&
    env.NODE_ENV !== "test" &&
    !env.SCRAPING_FIXTURE_SOURCE_ENABLED
  ) {
    throw sourceNotApprovedError();
  }
};

export const assertSourceEnabled = async (
  sourceKey: string,
): Promise<ApprovedSource> => {
  const source = await getApprovedSource(sourceKey);
  assertFixtureMode(source);
  if (source.status === "BLOCKED") throw sourceBlockedError();
  if (source.status === "REVIEW_REQUIRED") throw sourceReviewRequiredError();
  if (source.status !== "APPROVED" || !source.isEnabled) {
    throw sourceNotApprovedError();
  }
  return source;
};

export const assertAutomatedAccessAllowed = async (
  sourceKey: string,
): Promise<ApprovedSource> => {
  const source = await assertSourceEnabled(sourceKey);
  if (!source.allowsAutomatedAccess) throw automatedAccessNotAllowedError();
  if (sourceKey === "permitted-http-directory") {
    if (
      !env.SCRAPING_EXTERNAL_SOURCE_ENABLED ||
      !env.SCRAPING_APPROVED_BASE_URL ||
      !source.baseUrl
    ) {
      throw sourceReviewRequiredError();
    }
    try {
      if (
        new URL(source.baseUrl).origin !==
        new URL(env.SCRAPING_APPROVED_BASE_URL).origin
      ) {
        throw sourceReviewRequiredError();
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AdminError") throw error;
      throw sourceReviewRequiredError();
    }
  }
  return source;
};

export const markSourceBlocked = async (
  sourceKey: string,
  reason: string,
): Promise<void> =>
  setSourcePolicyState(sourceKey, {
    status: "BLOCKED",
    reason: reason.slice(0, 500),
  });

export const markSourceReviewRequired = async (
  sourceKey: string,
  reason: string,
): Promise<void> =>
  setSourcePolicyState(sourceKey, {
    status: "REVIEW_REQUIRED",
    reason: reason.slice(0, 500),
  });

export const recordRobotsCheck = async (sourceKey: string): Promise<void> =>
  recordSourceRobotsCheck(sourceKey);

export const getRateLimitPolicy = async (
  sourceKey: string,
): Promise<SourceRateLimitPolicy> => {
  const source = await assertAutomatedAccessAllowed(sourceKey);
  return {
    requestsPerMinute: source.requestsPerMinute,
    maxConcurrency: source.maxConcurrency,
  };
};
