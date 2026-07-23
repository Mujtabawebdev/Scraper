import type { NormalizedBusiness } from "./lead-normalization.service.js";

const normalized = (value: string | null): string => value?.trim().toLowerCase() ?? "";

export const getDeduplicationKeys = (record: NormalizedBusiness): string[] => {
  const name = normalized(record.businessName);
  const keys: string[] = [];
  if (record.sourceExternalId) {
    keys.push(`source:${record.sourceType}:${normalized(record.sourceName)}:${normalized(record.sourceExternalId)}`);
  }
  if (record.domain && record.city) keys.push(`domain:${record.domain}:${name}:${normalized(record.city)}`);
  if (record.phoneNormalized) keys.push(`phone:${record.phoneNormalized}:${name}`);
  if (record.addressLine1 && record.postalCode) {
    keys.push(`address:${name}:${normalized(record.addressLine1)}:${normalized(record.postalCode)}`);
  }
  return keys;
};

export const deduplicateBatch = (
  records: NormalizedBusiness[],
): { unique: NormalizedBusiness[]; duplicates: number } => {
  const seen = new Set<string>();
  const unique: NormalizedBusiness[] = [];
  let duplicates = 0;

  for (const record of records) {
    const keys = getDeduplicationKeys(record);
    if (keys.some((key) => seen.has(key))) {
      duplicates += 1;
      continue;
    }
    keys.forEach((key) => seen.add(key));
    unique.push(record);
  }
  return { unique, duplicates };
};
