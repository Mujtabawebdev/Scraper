export type ConfidenceSignals = {
  officialWebsite: boolean;
  schemaOrg: boolean;
  googlePhoneMatched: boolean;
  domainMatched: boolean;
  addressMatched: boolean;
  validPhone: boolean;
  sourceCount: number;
  conflictingPhones: boolean;
  placeholderOrInvalid: boolean;
  recentlyChecked: boolean;
};

export type ConfidenceResult = {
  score: number;
  level: "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";
};

export const scoreConfidence = (
  signals: ConfidenceSignals,
): ConfidenceResult => {
  let score = 10;
  if (signals.officialWebsite) score += 30;
  if (signals.schemaOrg) score += 10;
  if (signals.googlePhoneMatched) score += 15;
  if (signals.domainMatched) score += 5;
  if (signals.addressMatched) score += 5;
  if (signals.validPhone) score += 20;
  if (signals.sourceCount > 1) score += Math.min(10, (signals.sourceCount - 1) * 5);
  if (signals.recentlyChecked) score += 5;
  if (signals.conflictingPhones) score -= 25;
  if (signals.placeholderOrInvalid) score -= 40;
  score = Math.min(100, Math.max(0, score));

  return {
    score,
    level:
      score >= 90
        ? "HIGH"
        : score >= 70
          ? "MEDIUM"
          : score >= 40
            ? "LOW"
            : "VERY_LOW",
  };
};
