import { env } from "../../config/env.js";

export const isSourceCredentialConfigured = (sourceKey: string): boolean => {
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

export const isSourceRuntimeConfigured = (sourceKey: string): boolean => {
  if (sourceKey === "google-places-api") {
    return Boolean(env.GOOGLE_PLACES_API_KEY);
  }
  if (sourceKey === "government-dataset") {
    // A URL alone is intentionally insufficient until a reviewed mapper exists.
    return false;
  }
  if (sourceKey === "meta-approved-api" || sourceKey === "yelp-approved-api") {
    // Phase 9 exposes configuration-aware foundations only.
    return false;
  }
  if (sourceKey === "permitted-http-directory") {
    return (
      env.SCRAPING_EXTERNAL_SOURCE_ENABLED &&
      Boolean(env.SCRAPING_APPROVED_BASE_URL)
    );
  }
  return true;
};
