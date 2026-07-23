import type { AvailableSource } from "@lead-saas/shared-types";

export type SourceCatalogueEntry = Pick<
  AvailableSource,
  "key" | "description" | "canCreateJob" | "supportsWebsiteEnrichment"
>;
