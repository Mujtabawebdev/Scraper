import type {
  AvailableSource,
  AvailableSourceState,
} from "@lead-saas/shared-types";

import { listRealSourcePolicies } from "./source.repository.js";
import type { SourceCatalogueEntry } from "./source.types.js";
import {
  isSourceCredentialConfigured,
  isSourceRuntimeConfigured,
} from "./source-configuration.js";

const catalogue = {
  "google-places-api": {
    key: "google-places-api",
    description:
      "Official Google Places discovery with durable Place ID and official-website enrichment.",
    canCreateJob: true,
    supportsWebsiteEnrichment: true,
  },
  "official-website": {
    key: "official-website",
    description:
      "Restricted contact-page enrichment for websites discovered by an approved source.",
    canCreateJob: false,
    supportsWebsiteEnrichment: true,
  },
  "government-dataset": {
    key: "government-dataset",
    description:
      "Configuration-ready foundation for reviewed official public datasets.",
    canCreateJob: true,
    supportsWebsiteEnrichment: true,
  },
  "licensed-csv-import": {
    key: "licensed-csv-import",
    description:
      "Rights-confirmed CSV import with validation, deduplication and provenance.",
    canCreateJob: false,
    supportsWebsiteEnrichment: false,
  },
  "meta-approved-api": {
    key: "meta-approved-api",
    description:
      "Approved API foundation only; webpage scraping is never used.",
    canCreateJob: true,
    supportsWebsiteEnrichment: false,
  },
  "yelp-approved-api": {
    key: "yelp-approved-api",
    description:
      "Approved API foundation only; restriction bypass and webpage scraping are disabled.",
    canCreateJob: true,
    supportsWebsiteEnrichment: false,
  },
} as const satisfies Record<string, SourceCatalogueEntry>;

const deriveState = (source: {
  key: string;
  status: "APPROVED" | "DISABLED" | "BLOCKED" | "REVIEW_REQUIRED";
  isEnabled: boolean;
  requiresApiKey: boolean;
  allowsAutomatedAccess: boolean;
}): AvailableSourceState => {
  if (source.status === "BLOCKED") return "BLOCKED";
  if (source.status === "REVIEW_REQUIRED") return "REVIEW_REQUIRED";
  if (source.status === "DISABLED" || !source.isEnabled) return "DISABLED";
  if (
    source.requiresApiKey &&
    !isSourceCredentialConfigured(source.key)
  ) {
    return "MISSING_CREDENTIALS";
  }
  if (!isSourceRuntimeConfigured(source.key)) return "NOT_IMPLEMENTED";
  return source.status === "APPROVED" && source.allowsAutomatedAccess
    ? "AVAILABLE"
    : "DISABLED";
};

export const getAvailableSources = async (): Promise<AvailableSource[]> => {
  const sources = await listRealSourcePolicies();
  return sources
    .filter((source) => source.key in catalogue)
    .map((source) => {
      const definition = catalogue[source.key as keyof typeof catalogue];
      const state = deriveState(source);
      return {
        key: source.key,
        displayName: source.displayName,
        sourceType: source.sourceType,
        description: definition.description,
        state,
        canCreateJob: definition.canCreateJob && state === "AVAILABLE",
        supportsWebsiteEnrichment: definition.supportsWebsiteEnrichment,
        credentialConfigured:
          !source.requiresApiKey ||
          isSourceCredentialConfigured(source.key),
      };
    });
};
